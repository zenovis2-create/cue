//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"unsafe"
)

const (
	protocol                  = "cue-change-snapshot-v1"
	compareWriteProtocol      = "cue-change-snapshot-v2"
	fileReadData              = 1
	fileWriteData             = 2
	fileReadAttributes        = 0x80
	synchronize               = 0x100000
	shareRead                 = 1
	shareWrite                = 2
	shareDelete               = 4
	targetShareNone           = 0
	openExisting              = 3
	fileOpen                  = 1
	fileDirectoryFile         = 1
	fileNonDirectoryFile      = 0x40
	fileSynchronousIONonalert = 0x20
	fileOpenReparsePoint      = 0x200000
	objCaseInsensitive        = 0x40
	objDontReparse            = 0x1000
	fileFlagBackupSemantics   = 0x02000000
	fileFlagOpenReparsePoint  = 0x00200000
	fileAttributeDirectory    = 0x10
	fileAttributeReparse      = 0x400
	fileAttributeSparse       = 0x200
	fileIdInfoClass           = 18
	fileStandardInfoClass     = 1
	fileAttributeTagInfoClass = 9
	maxCompareWriteBytes      = 16 * 1024 * 1024
)

var (
	kernel32                     = syscall.NewLazyDLL("kernel32.dll")
	ntdll                        = syscall.NewLazyDLL("ntdll.dll")
	createFileW                  = kernel32.NewProc("CreateFileW")
	getFileInformationByHandleEx = kernel32.NewProc("GetFileInformationByHandleEx")
	readFile                     = kernel32.NewProc("ReadFile")
	writeFile                    = kernel32.NewProc("WriteFile")
	setFilePointerEx             = kernel32.NewProc("SetFilePointerEx")
	setEndOfFile                 = kernel32.NewProc("SetEndOfFile")
	flushFileBuffers             = kernel32.NewProc("FlushFileBuffers")
	ntCreateFile                 = ntdll.NewProc("NtCreateFile")
)

type request struct {
	Version               string    `json:"version"`
	Nonce                 string    `json:"nonce"`
	Operation             string    `json:"operation"`
	Root                  string    `json:"root"`
	ExpectedRoot          *identity `json:"expectedRoot,omitempty"`
	Targets               []string  `json:"targets,omitempty"`
	MaxBytes              uint32    `json:"maxBytes,omitempty"`
	Target                string    `json:"target,omitempty"`
	Expected              *receipt  `json:"expected,omitempty"`
	Replacement           string    `json:"replacement,omitempty"`
	ReplacementByteLength *uint64   `json:"replacementByteLength,omitempty"`
	ReplacementSHA256     string    `json:"replacementSha256,omitempty"`
}
type identity struct {
	VolumeSerial string `json:"volumeSerial"`
	FileID       string `json:"fileId"`
}
type result struct {
	Path       string    `json:"path"`
	State      string    `json:"state"`
	Reason     string    `json:"reason,omitempty"`
	Identity   *identity `json:"identity,omitempty"`
	ByteLength *uint64   `json:"byteLength,omitempty"`
	SHA256     *string   `json:"sha256,omitempty"`
	Bytes      *string   `json:"bytes,omitempty"`
}
type receipt struct {
	Identity   identity `json:"identity"`
	ByteLength uint64   `json:"byteLength"`
	SHA256     string   `json:"sha256"`
}
type response struct {
	Version      string    `json:"version"`
	Nonce        string    `json:"nonce"`
	State        string    `json:"state"`
	Reason       string    `json:"reason,omitempty"`
	RootIdentity *identity `json:"rootIdentity,omitempty"`
	Results      []result  `json:"results,omitempty"`
	Before       *receipt  `json:"before,omitempty"`
	After        *receipt  `json:"after,omitempty"`
}
type unicodeString struct {
	Length        uint16
	MaximumLength uint16
	Buffer        *uint16
}
type objectAttributes struct {
	Length                   uint32
	RootDirectory            syscall.Handle
	ObjectName               *unicodeString
	Attributes               uint32
	SecurityDescriptor       uintptr
	SecurityQualityOfService uintptr
}
type ioStatusBlock struct {
	Status      uintptr
	Information uintptr
}
type fileIDInfo struct {
	VolumeSerial uint64
	FileID       [16]byte
}
type fileStandardInfo struct {
	AllocationSize int64
	EndOfFile      int64
	NumberOfLinks  uint32
	DeletePending  byte
	Directory      byte
	_              [2]byte
}
type fileAttributeTagInfo struct {
	FileAttributes uint32
	ReparseTag     uint32
}

func query(h syscall.Handle, class uint32, out unsafe.Pointer, size uintptr) error {
	r, _, e := getFileInformationByHandleEx.Call(uintptr(h), uintptr(class), uintptr(out), size)
	if r == 0 {
		return e
	}
	return nil
}
func getIdentity(h syscall.Handle) (identity, error) {
	var v fileIDInfo
	if err := query(h, fileIdInfoClass, unsafe.Pointer(&v), unsafe.Sizeof(v)); err != nil {
		return identity{}, err
	}
	return identity{VolumeSerial: hex.EncodeToString((*[8]byte)(unsafe.Pointer(&v.VolumeSerial))[:]), FileID: hex.EncodeToString(v.FileID[:])}, nil
}
func openRoot(path string) (syscall.Handle, identity, error) {
	return openRootShared(path, shareRead)
}
func openRootShared(path string, rootShare uintptr) (syscall.Handle, identity, error) {
	clean := filepath.Clean(path)
	volume := filepath.VolumeName(clean)
	if len(volume) != 2 || volume[1] != ':' || !filepath.IsAbs(clean) {
		return 0, identity{}, errors.New("unsupported_root_path")
	}
	p, err := syscall.UTF16PtrFromString(volume + "\\")
	if err != nil {
		return 0, identity{}, err
	}
	v, _, e := createFileW.Call(uintptr(unsafe.Pointer(p)), fileReadAttributes|synchronize, shareRead|shareWrite|shareDelete, 0, openExisting, fileFlagBackupSemantics|fileFlagOpenReparsePoint, 0)
	if syscall.Handle(v) == syscall.InvalidHandle {
		return 0, identity{}, e
	}
	volumeHandle := syscall.Handle(v)
	defer syscall.CloseHandle(volumeHandle)
	relative := strings.TrimPrefix(clean[len(volume):], "\\")
	if relative == "" {
		return 0, identity{}, errors.New("volume_root_not_supported")
	}
	handle, _, err := ntOpenRelativeShared(volumeHandle, relative, fileReadAttributes|synchronize, fileDirectoryFile|fileSynchronousIONonalert|fileOpenReparsePoint, rootShare)
	if err != nil {
		return 0, identity{}, err
	}
	var tag fileAttributeTagInfo
	if err := query(handle, fileAttributeTagInfoClass, unsafe.Pointer(&tag), unsafe.Sizeof(tag)); err != nil || tag.FileAttributes&fileAttributeDirectory == 0 || tag.FileAttributes&fileAttributeReparse != 0 {
		syscall.CloseHandle(handle)
		if err != nil {
			return 0, identity{}, err
		}
		return 0, identity{}, errors.New("root_not_plain_directory")
	}
	id, err := getIdentity(handle)
	if err != nil {
		syscall.CloseHandle(handle)
		return 0, identity{}, err
	}
	return handle, id, nil
}

var reservedComponent = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$`)

func relativeName(s string) (*unicodeString, []uint16, error) {
	if s == "" || filepath.IsAbs(s) || strings.Contains(s, ":") || strings.ContainsRune(s, 0) {
		return nil, nil, errors.New("invalid_relative_path")
	}
	components := strings.Split(strings.ReplaceAll(s, "/", "\\"), "\\")
	for _, component := range components {
		if component == "" || component == "." || component == ".." || strings.HasSuffix(component, ".") || strings.HasSuffix(component, " ") || reservedComponent.MatchString(component) {
			return nil, nil, errors.New("invalid_relative_path")
		}
	}
	clean := strings.Join(components, "\\")
	u, err := syscall.UTF16FromString(clean)
	if err != nil || len(u) > 32767 {
		return nil, nil, errors.New("invalid_relative_path")
	}
	return &unicodeString{Length: uint16((len(u) - 1) * 2), MaximumLength: uint16((len(u) - 1) * 2), Buffer: &u[0]}, u, nil
}
func ntOpenRelative(root syscall.Handle, name string, access uintptr, options uintptr) (syscall.Handle, uint32, error) {
	share := uintptr(targetShareNone)
	if options&fileDirectoryFile != 0 {
		share = shareRead
	}
	return ntOpenRelativeShared(root, name, access, options, share)
}
func ntOpenRelativeShared(root syscall.Handle, name string, access uintptr, options uintptr, share uintptr) (syscall.Handle, uint32, error) {
	u, keep, err := relativeName(name)
	if err != nil {
		return 0, 0, err
	}
	_ = keep
	oa := objectAttributes{Length: uint32(unsafe.Sizeof(objectAttributes{})), RootDirectory: root, ObjectName: u, Attributes: objCaseInsensitive | objDontReparse}
	var ios ioStatusBlock
	var h syscall.Handle
	status, _, _ := ntCreateFile.Call(uintptr(unsafe.Pointer(&h)), access, uintptr(unsafe.Pointer(&oa)), uintptr(unsafe.Pointer(&ios)), 0, 0, share, fileOpen, options, 0, 0)
	if int32(status) < 0 {
		return 0, uint32(status), syscall.Errno(status)
	}
	return h, uint32(status), nil
}
func openRelative(root syscall.Handle, name string) (syscall.Handle, uint32, error) {
	return ntOpenRelative(root, name, fileReadData|fileReadAttributes|synchronize, fileNonDirectoryFile|fileSynchronousIONonalert|fileOpenReparsePoint)
}
func snapshot(root syscall.Handle, path string, cap uint32) result {
	r := result{Path: path, State: "unknown"}
	h, status, err := openRelative(root, path)
	if err != nil {
		if status == 0xC0000034 || status == 0xC000003A {
			r.State = "absent"
			return r
		}
		if status == 0 || err.Error() == "invalid_relative_path" {
			r.State = "unavailable"
			r.Reason = "invalid-path"
		} else {
			r.Reason = "open-failed"
		}
		return r
	}
	defer syscall.CloseHandle(h)
	var before fileStandardInfo
	var tag fileAttributeTagInfo
	if query(h, fileStandardInfoClass, unsafe.Pointer(&before), unsafe.Sizeof(before)) != nil || query(h, fileAttributeTagInfoClass, unsafe.Pointer(&tag), unsafe.Sizeof(tag)) != nil {
		r.Reason = "stat-failed"
		return r
	}
	if before.Directory != 0 || before.NumberOfLinks != 1 || tag.FileAttributes&(fileAttributeReparse|fileAttributeSparse) != 0 {
		r.State = "unavailable"
		r.Reason = "unsupported-file"
		return r
	}
	if before.EndOfFile < 0 || uint64(before.EndOfFile) > uint64(cap) {
		r.State = "unavailable"
		r.Reason = "byte-limit"
		return r
	}
	id1, err := getIdentity(h)
	if err != nil {
		r.Reason = "identity-failed"
		return r
	}
	buf := make([]byte, int(before.EndOfFile))
	var offset uint32
	for offset < uint32(len(buf)) {
		var n uint32
		ok, _, _ := readFile.Call(uintptr(h), uintptr(unsafe.Pointer(&buf[offset])), uintptr(len(buf)-int(offset)), uintptr(unsafe.Pointer(&n)), 0)
		if ok == 0 || n == 0 {
			r.Reason = "read-failed"
			return r
		}
		offset += n
	}
	var after fileStandardInfo
	id2, idErr := getIdentity(h)
	if idErr != nil || query(h, fileStandardInfoClass, unsafe.Pointer(&after), unsafe.Sizeof(after)) != nil || before.EndOfFile != after.EndOfFile || before.NumberOfLinks != after.NumberOfLinks || id1 != id2 {
		r.Reason = "file-drift"
		return r
	}
	digest := sha256.Sum256(buf)
	byteLength := uint64(len(buf))
	digestText := hex.EncodeToString(digest[:])
	bytesText := base64.StdEncoding.EncodeToString(buf)
	r.State = "ok"
	r.Identity = &id1
	r.ByteLength = &byteLength
	r.SHA256 = &digestText
	r.Bytes = &bytesText
	return r
}

func validIdentity(value *identity) bool {
	if value == nil || len(value.VolumeSerial) != 16 || len(value.FileID) != 32 || strings.ToLower(value.VolumeSerial) != value.VolumeSerial || strings.ToLower(value.FileID) != value.FileID {
		return false
	}
	_, err := hex.DecodeString(value.VolumeSerial + value.FileID)
	return err == nil
}

func validDigest(value string) bool {
	if len(value) != 64 || strings.ToLower(value) != value {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func seekStart(h syscall.Handle) error {
	r, _, e := setFilePointerEx.Call(uintptr(h), 0, 0, 0)
	if r == 0 {
		return e
	}
	return nil
}

func readExact(h syscall.Handle, length uint64) ([]byte, error) {
	if length > maxCompareWriteBytes {
		return nil, errors.New("byte-limit")
	}
	if err := seekStart(h); err != nil {
		return nil, err
	}
	buf := make([]byte, int(length))
	for offset := 0; offset < len(buf); {
		var n uint32
		ok, _, e := readFile.Call(uintptr(h), uintptr(unsafe.Pointer(&buf[offset])), uintptr(len(buf)-offset), uintptr(unsafe.Pointer(&n)), 0)
		if ok == 0 {
			return nil, e
		}
		if n == 0 {
			return nil, io.ErrUnexpectedEOF
		}
		offset += int(n)
	}
	return buf, nil
}

func inspectPlainFile(h syscall.Handle, cap uint64) (receipt, []byte, error) {
	var info fileStandardInfo
	var tag fileAttributeTagInfo
	if err := query(h, fileStandardInfoClass, unsafe.Pointer(&info), unsafe.Sizeof(info)); err != nil {
		return receipt{}, nil, err
	}
	if err := query(h, fileAttributeTagInfoClass, unsafe.Pointer(&tag), unsafe.Sizeof(tag)); err != nil {
		return receipt{}, nil, err
	}
	if info.Directory != 0 || info.NumberOfLinks != 1 || tag.FileAttributes&(fileAttributeReparse|fileAttributeSparse) != 0 {
		return receipt{}, nil, errors.New("unsupported-file")
	}
	if info.EndOfFile < 0 || uint64(info.EndOfFile) > cap {
		return receipt{}, nil, errors.New("byte-limit")
	}
	id, err := getIdentity(h)
	if err != nil {
		return receipt{}, nil, err
	}
	bytes, err := readExact(h, uint64(info.EndOfFile))
	if err != nil {
		return receipt{}, nil, err
	}
	var after fileStandardInfo
	afterID, idErr := getIdentity(h)
	if idErr != nil || query(h, fileStandardInfoClass, unsafe.Pointer(&after), unsafe.Sizeof(after)) != nil || after.EndOfFile != info.EndOfFile || after.NumberOfLinks != info.NumberOfLinks || afterID != id {
		return receipt{}, nil, errors.New("file-drift")
	}
	digest := sha256.Sum256(bytes)
	return receipt{Identity: id, ByteLength: uint64(len(bytes)), SHA256: hex.EncodeToString(digest[:])}, bytes, nil
}

func plainDirectoryIdentity(h syscall.Handle) (identity, error) {
	var info fileStandardInfo
	var tag fileAttributeTagInfo
	if err := query(h, fileStandardInfoClass, unsafe.Pointer(&info), unsafe.Sizeof(info)); err != nil {
		return identity{}, err
	}
	if err := query(h, fileAttributeTagInfoClass, unsafe.Pointer(&tag), unsafe.Sizeof(tag)); err != nil {
		return identity{}, err
	}
	if info.Directory == 0 || tag.FileAttributes&fileAttributeDirectory == 0 || tag.FileAttributes&fileAttributeReparse != 0 {
		return identity{}, errors.New("unsupported-directory")
	}
	return getIdentity(h)
}

func closeHandles(handles []syscall.Handle) {
	for index := len(handles) - 1; index >= 0; index-- {
		syscall.CloseHandle(handles[index])
	}
}

func writeReplacement(h syscall.Handle, replacement []byte) error {
	if err := seekStart(h); err != nil {
		return err
	}
	for offset := 0; offset < len(replacement); {
		var n uint32
		ok, _, e := writeFile.Call(uintptr(h), uintptr(unsafe.Pointer(&replacement[offset])), uintptr(len(replacement)-offset), uintptr(unsafe.Pointer(&n)), 0)
		if ok == 0 {
			return e
		}
		if n == 0 {
			return io.ErrShortWrite
		}
		offset += int(n)
	}
	if err := seekStart(h); err != nil {
		return err
	}
	if len(replacement) != 0 {
		r, _, e := setFilePointerEx.Call(uintptr(h), uintptr(int64(len(replacement))), 0, 0)
		if r == 0 {
			return e
		}
	}
	r, _, e := setEndOfFile.Call(uintptr(h))
	if r == 0 {
		return e
	}
	r, _, e = flushFileBuffers.Call(uintptr(h))
	if r == 0 {
		return e
	}
	return nil
}

func contention(q request, reason string) response {
	return response{Version: compareWriteProtocol, Nonce: q.Nonce, State: "contention", Reason: reason}
}

func unknownWrite(q request, reason string) response {
	return response{Version: compareWriteProtocol, Nonce: q.Nonce, State: "unknown", Reason: reason}
}

func decodeCompareWriteRequest(q request) ([]byte, string) {
	validRequest := q.Operation == "compareWriteExisting" && validIdentity(q.ExpectedRoot) && q.Target != "" && len(q.Target) <= 32768 && q.Expected != nil && validIdentity(&q.Expected.Identity) && validDigest(q.Expected.SHA256) && q.ReplacementByteLength != nil && validDigest(q.ReplacementSHA256) && q.MaxBytes > 0 && q.MaxBytes <= maxCompareWriteBytes && q.Expected.ByteLength <= uint64(q.MaxBytes) && *q.ReplacementByteLength <= uint64(q.MaxBytes) && len(q.Targets) == 0
	if !validRequest {
		return nil, "request"
	}
	if _, _, err := relativeName(q.Target); err != nil {
		return nil, "request"
	}
	replacement, err := base64.StdEncoding.DecodeString(q.Replacement)
	digest := sha256.Sum256(replacement)
	if err != nil || base64.StdEncoding.EncodeToString(replacement) != q.Replacement || uint64(len(replacement)) != *q.ReplacementByteLength || hex.EncodeToString(digest[:]) != q.ReplacementSHA256 {
		return nil, "replacement-binding"
	}
	return replacement, ""
}

func compareWriteExisting(q request, replacement []byte) response {
	root, rootID, err := openRootShared(q.Root, targetShareNone)
	if err != nil {
		return contention(q, "root-open-failed")
	}
	handles := []syscall.Handle{root}
	defer func() { closeHandles(handles) }()
	if rootID != *q.ExpectedRoot {
		return contention(q, "root-identity")
	}
	_, _, err = relativeName(q.Target)
	if err != nil {
		return contention(q, "invalid-path")
	}
	components := strings.Split(strings.ReplaceAll(q.Target, "/", "\\"), "\\")
	directoryIDs := []identity{rootID}
	parent := root
	for _, component := range components[:len(components)-1] {
		h, _, openErr := ntOpenRelativeShared(parent, component, fileReadAttributes|synchronize, fileDirectoryFile|fileSynchronousIONonalert|fileOpenReparsePoint, targetShareNone)
		if openErr != nil {
			return contention(q, "ancestor-open-failed")
		}
		handles = append(handles, h)
		id, inspectErr := plainDirectoryIdentity(h)
		if inspectErr != nil {
			return contention(q, "unsupported-ancestor")
		}
		directoryIDs = append(directoryIDs, id)
		parent = h
	}
	target, status, openErr := ntOpenRelativeShared(parent, components[len(components)-1], fileReadData|fileWriteData|fileReadAttributes|synchronize, fileNonDirectoryFile|fileSynchronousIONonalert|fileOpenReparsePoint, targetShareNone)
	if openErr != nil {
		if status == 0xC0000034 || status == 0xC000003A {
			return contention(q, "absent")
		}
		return contention(q, "target-open-failed")
	}
	handles = append(handles, target)
	before, _, inspectErr := inspectPlainFile(target, uint64(q.MaxBytes))
	if inspectErr != nil {
		return contention(q, inspectErr.Error())
	}
	if before != *q.Expected {
		return contention(q, "preimage-mismatch")
	}
	for index, h := range handles[:len(handles)-1] {
		id, verifyErr := plainDirectoryIdentity(h)
		if verifyErr != nil || id != directoryIDs[index] {
			return contention(q, "ancestor-drift")
		}
	}
	confirmed, _, confirmErr := inspectPlainFile(target, uint64(q.MaxBytes))
	if confirmErr != nil || confirmed != before {
		return contention(q, "target-drift")
	}
	if err := writeReplacement(target, replacement); err != nil {
		return unknownWrite(q, "write-or-flush-failed")
	}
	after, bytes, inspectErr := inspectPlainFile(target, uint64(q.MaxBytes))
	if inspectErr != nil || after.Identity != before.Identity || after.ByteLength != *q.ReplacementByteLength || after.SHA256 != q.ReplacementSHA256 || string(bytes) != string(replacement) {
		return unknownWrite(q, "post-write-verification")
	}
	return response{Version: compareWriteProtocol, Nonce: q.Nonce, State: "committed", RootIdentity: &rootID, Before: &before, After: &after}
}

func main() {
	limited := io.LimitReader(os.Stdin, 24*1024*1024+1)
	dec := json.NewDecoder(limited)
	dec.DisallowUnknownFields()
	var q request
	if dec.Decode(&q) != nil || (q.Version != protocol && q.Version != compareWriteProtocol) || q.Nonce == "" || len(q.Nonce) > 128 || len(q.Root) == 0 || len(q.Root) > 32768 || strings.ContainsRune(q.Root, 0) {
		os.Exit(2)
	}
	var extra any
	if dec.Decode(&extra) != io.EOF {
		os.Exit(2)
	}
	if q.Version == compareWriteProtocol {
		replacement, reason := decodeCompareWriteRequest(q)
		if reason != "" {
			json.NewEncoder(os.Stdout).Encode(contention(q, reason))
			return
		}
		json.NewEncoder(os.Stdout).Encode(compareWriteExisting(q, replacement))
		return
	}
	out := response{Version: protocol, Nonce: q.Nonce, State: "unknown"}
	if q.Target != "" || q.Expected != nil || q.Replacement != "" || q.ReplacementByteLength != nil || q.ReplacementSHA256 != "" {
		out.State = "unavailable"
		out.Reason = "request"
		json.NewEncoder(os.Stdout).Encode(out)
		return
	}
	root, id, err := openRoot(q.Root)
	if err != nil {
		out.Reason = "root-open-failed"
		json.NewEncoder(os.Stdout).Encode(out)
		return
	}
	defer syscall.CloseHandle(root)
	if q.Operation == "identifyRoot" && q.ExpectedRoot == nil && len(q.Targets) == 0 {
		out.State = "ok"
		out.RootIdentity = &id
		json.NewEncoder(os.Stdout).Encode(out)
		return
	}
	validExpected := validIdentity(q.ExpectedRoot)
	if q.Operation != "snapshotRelative" || !validExpected || *q.ExpectedRoot != id || q.MaxBytes == 0 || q.MaxBytes > 16*1024*1024 || len(q.Targets) == 0 || len(q.Targets) > 64 || uint64(len(q.Targets))*uint64(q.MaxBytes) > 16*1024*1024 {
		out.State = "unavailable"
		out.Reason = "root-identity-or-request"
		json.NewEncoder(os.Stdout).Encode(out)
		return
	}
	out.State = "ok"
	out.RootIdentity = &id
	out.Results = make([]result, len(q.Targets))
	for i, p := range q.Targets {
		out.Results[i] = snapshot(root, p, q.MaxBytes)
	}
	json.NewEncoder(os.Stdout).Encode(out)
}
