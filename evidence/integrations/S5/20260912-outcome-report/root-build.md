# Shared build receipts

Root ran `npm --prefix daemon run build` after both makers declared their source stable.

- Initial integration build: exit 0, tool chunk `0f6d08`, 1.4477478 seconds. Report/Core compiled tests followed this build.
- Policy ID privacy correction build: exit 0, tool chunk `92c055`, 1.2333803 seconds. Backend source `F78128B66F3FEB4194F847349F19D74B875FF18D97F271C2BE03E9C2C366A072`; compiled backend `E08A91956196543DB2E2BE91DDAA20BAF422522FCE5663B978AA3118698AA714` independently checked afterward.

The second build was required by a source correction. Earlier test and Node fixture receipts keep their original source scope. No qualification or model call was made. Source/build were frozen for the separately authorized actual report QA attempt 1.
