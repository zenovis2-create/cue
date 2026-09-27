# Shared build and regression receipt

The source prerequisite has a limited independent ordering verdict. Its shared continuation seam is behaviorally tested; full LaunchCore native cleanup following GetProcessTimes failure remains source-inspected rather than runtime-proven.

- Root tool `5c04bb`: generator, diagnostic bridge, and real control/bootstrap regression suites pass, three files and 16 tests. This supplements the independently reviewed 17 prerequisite/observation/terminal cases, giving 33 distinct cases in this source change's gates.
- Root tool `143507`: `npm run build` from `daemon` exits 0.
- Root tool `d5c0ed`: generated artifact equals the pure renderer byte for byte. It is 48,399 bytes with SHA-256 `F5E03DE26E29B95DC42A012F280E8B37A1A1E76CF2A02B54D2ECF4F5557EB9D3`.
- The canonical base launcher and packaged copy match at SHA-256 `9181E9D20C4137FB7472FAC8D0FEF1C43583DF0E5AD71FB3FDBD593F496FB3C9`.

These gates compile and exercise injected source paths without executing the native generated wrapper. The early PID/FileTime frame establishes created identity only; readiness, resume, death, cleanup, permission qualification, and production registration do not follow from emitting it. Any subsequent native smoke must verify death and poststate independently and retain unknown state on incomplete evidence.
