//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"unsafe"
)

func digestBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func testBinding(t *testing.T, rootPath, target string) (identity, receipt) {
	t.Helper()
	root, rootID, err := openRoot(rootPath)
	if err != nil {
		t.Fatal(err)
	}
	defer closeHandles([]syscall.Handle{root})
	h, _, err := openRelative(root, target)
	if err != nil {
		t.Fatal(err)
	}
	defer closeHandles([]syscall.Handle{h})
	got, _, err := inspectPlainFile(h, maxCompareWriteBytes)
	if err != nil {
		t.Fatal(err)
	}
	return rootID, got
}

func compareRequest(rootPath, target string, rootID identity, expected receipt, replacement []byte) request {
	length := uint64(len(replacement))
	return request{Version: compareWriteProtocol, Nonce: "test-nonce", Operation: "compareWriteExisting", Root: rootPath, ExpectedRoot: &rootID, Target: target, Expected: &expected, ReplacementByteLength: &length, ReplacementSHA256: digestBytes(replacement), MaxBytes: maxCompareWriteBytes}
}

func TestCompareWriteWinnerAndStaleLoser(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "nested"), 0o700); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join("nested", "value.json")
	beforeBytes := []byte("P")
	if err := os.WriteFile(filepath.Join(root, target), beforeBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	rootID, before := testBinding(t, root, target)
	a := []byte("A")
	winner := compareWriteExisting(compareRequest(root, target, rootID, before, a), a)
	if winner.State != "committed" || winner.Before == nil || *winner.Before != before || winner.After == nil || winner.After.SHA256 != digestBytes(a) {
		t.Fatalf("unexpected winner: %#v", winner)
	}
	b := []byte("B")
	loser := compareWriteExisting(compareRequest(root, target, rootID, before, b), b)
	if loser.State != "contention" || loser.Reason != "preimage-mismatch" {
		t.Fatalf("unexpected stale loser: %#v", loser)
	}
	actual, err := os.ReadFile(filepath.Join(root, target))
	if err != nil || string(actual) != "A" {
		t.Fatalf("stale loser changed winner: %q, %v", actual, err)
	}
}

func TestCompareWriteRejectsHostilePreflightWithoutWriting(t *testing.T) {
	t.Run("replacement-binding", func(t *testing.T) {
		rootID := identity{VolumeSerial: strings.Repeat("1", 16), FileID: strings.Repeat("2", 32)}
		expected := receipt{Identity: identity{VolumeSerial: strings.Repeat("1", 16), FileID: strings.Repeat("3", 32)}, ByteLength: 1, SHA256: digestBytes([]byte("P"))}
		q := compareRequest(`C:\owned`, "value", rootID, expected, []byte("A"))
		q.Replacement = "QQ=="
		if _, reason := decodeCompareWriteRequest(q); reason != "" {
			t.Fatalf("valid binding rejected: %s", reason)
		}
		for _, corrupt := range []func(*request){
			func(value *request) { value.Replacement = "Qg==" },
			func(value *request) { *value.ReplacementByteLength = 2 },
			func(value *request) { value.ReplacementSHA256 = strings.Repeat("0", 64) },
		} {
			candidate := q
			length := *q.ReplacementByteLength
			candidate.ReplacementByteLength = &length
			corrupt(&candidate)
			if _, reason := decodeCompareWriteRequest(candidate); reason != "replacement-binding" {
				t.Fatalf("corrupt binding accepted: %#v reason=%s", candidate, reason)
			}
		}
	})
	t.Run("identity-length-and-hash", func(t *testing.T) {
		for _, mutate := range []func(*receipt){
			func(r *receipt) { r.Identity.FileID = strings.Repeat("0", 32) },
			func(r *receipt) { r.ByteLength++ },
			func(r *receipt) { r.SHA256 = strings.Repeat("0", 64) },
		} {
			root := t.TempDir()
			path := filepath.Join(root, "value")
			if err := os.WriteFile(path, []byte("original"), 0o600); err != nil {
				t.Fatal(err)
			}
			rootID, expected := testBinding(t, root, "value")
			mutate(&expected)
			result := compareWriteExisting(compareRequest(root, "value", rootID, expected, []byte("replacement")), []byte("replacement"))
			actual, _ := os.ReadFile(path)
			if result.State != "contention" || string(actual) != "original" {
				t.Fatalf("result=%#v bytes=%q", result, actual)
			}
		}
	})
	t.Run("absent", func(t *testing.T) {
		root := t.TempDir()
		rootHandle, rootID, err := openRoot(root)
		if err != nil {
			t.Fatal(err)
		}
		closeHandles([]syscall.Handle{rootHandle})
		expected := receipt{Identity: identity{VolumeSerial: strings.Repeat("0", 16), FileID: strings.Repeat("0", 32)}, SHA256: digestBytes(nil)}
		result := compareWriteExisting(compareRequest(root, "absent", rootID, expected, []byte("replacement")), []byte("replacement"))
		if result.State != "contention" || result.Reason != "absent" {
			t.Fatalf("unexpected result: %#v", result)
		}
		if _, err := os.Stat(filepath.Join(root, "absent")); !os.IsNotExist(err) {
			t.Fatalf("absent target was created: %v", err)
		}
	})
	t.Run("multiple-links", func(t *testing.T) {
		root := t.TempDir()
		path := filepath.Join(root, "value")
		if err := os.WriteFile(path, []byte("original"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Link(path, filepath.Join(root, "alias")); err != nil {
			t.Fatal(err)
		}
		rootHandle, rootID, err := openRoot(root)
		if err != nil {
			t.Fatal(err)
		}
		closeHandles([]syscall.Handle{rootHandle})
		expected := receipt{Identity: identity{VolumeSerial: strings.Repeat("0", 16), FileID: strings.Repeat("0", 32)}, ByteLength: 8, SHA256: digestBytes([]byte("original"))}
		result := compareWriteExisting(compareRequest(root, "value", rootID, expected, []byte("replacement")), []byte("replacement"))
		actual, _ := os.ReadFile(path)
		if result.State != "contention" || result.Reason != "unsupported-file" || string(actual) != "original" {
			t.Fatalf("result=%#v bytes=%q", result, actual)
		}
	})
	t.Run("existing-writer", func(t *testing.T) {
		root := t.TempDir()
		path := filepath.Join(root, "value")
		if err := os.WriteFile(path, []byte("original"), 0o600); err != nil {
			t.Fatal(err)
		}
		rootID, expected := testBinding(t, root, "value")
		writer, err := os.OpenFile(path, os.O_RDWR, 0)
		if err != nil {
			t.Fatal(err)
		}
		defer writer.Close()
		result := compareWriteExisting(compareRequest(root, "value", rootID, expected, []byte("replacement")), []byte("replacement"))
		actual, _ := os.ReadFile(path)
		if result.State != "contention" || result.Reason != "target-open-failed" || string(actual) != "original" {
			t.Fatalf("result=%#v bytes=%q", result, actual)
		}
	})
	t.Run("sparse", func(t *testing.T) {
		root := t.TempDir()
		path := filepath.Join(root, "value")
		if err := os.WriteFile(path, []byte("original"), 0o600); err != nil {
			t.Fatal(err)
		}
		name, err := syscall.UTF16PtrFromString(path)
		if err != nil {
			t.Fatal(err)
		}
		h, err := syscall.CreateFile(name, syscall.GENERIC_READ|syscall.GENERIC_WRITE, 0, nil, syscall.OPEN_EXISTING, 0, 0)
		if err != nil {
			t.Fatal(err)
		}
		var returned uint32
		deviceIoControl := syscall.NewLazyDLL("kernel32.dll").NewProc("DeviceIoControl")
		ok, _, callErr := deviceIoControl.Call(uintptr(h), 0x900c4, 0, 0, 0, 0, uintptr(unsafe.Pointer(&returned)), 0)
		syscall.CloseHandle(h)
		if ok == 0 {
			t.Skipf("sparse files unavailable: %v", callErr)
		}
		rootHandle, rootID, err := openRoot(root)
		if err != nil {
			t.Fatal(err)
		}
		closeHandles([]syscall.Handle{rootHandle})
		expected := receipt{Identity: identity{VolumeSerial: strings.Repeat("0", 16), FileID: strings.Repeat("0", 32)}, ByteLength: 8, SHA256: digestBytes([]byte("original"))}
		result := compareWriteExisting(compareRequest(root, "value", rootID, expected, []byte("replacement")), []byte("replacement"))
		actual, _ := os.ReadFile(path)
		if result.State != "contention" || result.Reason != "unsupported-file" || string(actual) != "original" {
			t.Fatalf("result=%#v bytes=%q", result, actual)
		}
	})
	t.Run("junction-ancestor", func(t *testing.T) {
		root := t.TempDir()
		outsideRoot := t.TempDir()
		outside := filepath.Join(outsideRoot, "outside")
		if err := os.WriteFile(outside, []byte("outside"), 0o600); err != nil {
			t.Fatal(err)
		}
		link := filepath.Join(root, "junction")
		if output, err := exec.Command("cmd.exe", "/d", "/c", "mklink", "/J", link, outsideRoot).CombinedOutput(); err != nil {
			t.Skipf("junction unavailable: %v: %s", err, output)
		}
		rootHandle, rootID, err := openRoot(root)
		if err != nil {
			t.Fatal(err)
		}
		closeHandles([]syscall.Handle{rootHandle})
		expected := receipt{Identity: identity{VolumeSerial: strings.Repeat("0", 16), FileID: strings.Repeat("0", 32)}, ByteLength: 7, SHA256: digestBytes([]byte("outside"))}
		result := compareWriteExisting(compareRequest(root, filepath.Join("junction", "outside"), rootID, expected, []byte("replacement")), []byte("replacement"))
		actual, _ := os.ReadFile(outside)
		if result.State != "contention" || string(actual) != "outside" {
			t.Fatalf("result=%#v bytes=%q", result, actual)
		}
	})
	t.Run("reparse-target", func(t *testing.T) {
		root := t.TempDir()
		outside := filepath.Join(t.TempDir(), "outside")
		if err := os.WriteFile(outside, []byte("outside"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(outside, filepath.Join(root, "link")); err != nil {
			t.Skipf("symlink unavailable: %v", err)
		}
		rootHandle, rootID, err := openRoot(root)
		if err != nil {
			t.Fatal(err)
		}
		closeHandles([]syscall.Handle{rootHandle})
		expected := receipt{Identity: identity{VolumeSerial: strings.Repeat("0", 16), FileID: strings.Repeat("0", 32)}, ByteLength: 7, SHA256: digestBytes([]byte("outside"))}
		result := compareWriteExisting(compareRequest(root, "link", rootID, expected, []byte("replacement")), []byte("replacement"))
		actual, _ := os.ReadFile(outside)
		if result.State != "contention" || string(actual) != "outside" {
			t.Fatalf("result=%#v bytes=%q", result, actual)
		}
	})
}
