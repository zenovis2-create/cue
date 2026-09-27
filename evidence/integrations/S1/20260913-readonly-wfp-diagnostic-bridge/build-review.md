# Root shared build and packaging review

PASS after both independent implementation reviews reached their terminal source verdicts.

- Tool `2d8862`: `npm run build` from `daemon`, exit 0. TypeScript compilation and the registered asset copy/generation script completed.
- Tool `ca3c10`: importing the pure renderer and comparing its UTF-8 result to the built WFP launcher found exact byte equality. The artifact is 47,963 bytes, SHA-256 `B8E3692DBF6622076EFE3AA3F44CB264A8754C8491D87C4D7766264AB049252E`.
- The base launcher, collector, and current adapter each match their corresponding packaged asset byte for byte. Their hashes are respectively `6060955CD91AFB9D0470697C1B8945A75850AFD3A0307CF60AC0063C271A48FF`, `5871FB8684AA3D8C2B6D635E3C31B6FD5A9FE45E18CDD9D7A1164C106C9CCB4F`, and `6566E134B895AF41C710E5D37580B5AF37EFDBEC00D98671E6DB9EAAEDC4C86C`.
- Root inspected the independently authored authority tests (`8184d7`, final containment check `2e1dbf`). They use the production worker and SQLite identity/cleanup store with complete session lineage; control verification and OS edges are mocked. The existing bootstrap tests separately use the production control implementation.

The producer's 35-case gate includes the same five parser cases present in the consumer's 18-case gate. Thus these reviews cover 48 distinct focused tests; the later eight-case test-only containment rerun is not added again. Exact generated C# emission, compilation, and return/exception preservation are supported by the independent producer review. These build checks do not execute the generated PowerShell wrapper, invoke WFP, select the variant in a production host, or establish runtime qualification.
