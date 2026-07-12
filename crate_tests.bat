echo. >> contracts\fee-router\src\lib.rs
echo mod test; >> contracts\fee-router\src\lib.rs
echo. >> contracts\payout\src\lib.rs
echo mod test; >> contracts\payout\src\lib.rs
cargo test -p escrow --color=never > output.log 2>&1
echo ============================== >> output.log
cargo test -p fee-router --color=never >> output.log 2>&1
echo ============================== >> output.log
cargo test -p payout --color=never >> output.log 2>&1
stellar contract build
echo ============================== >> output.log
powershell -Command "Get-Item target\wasm32v1-none\release\*.wasm | Select-Object Name, Length" >> output.log
git add .
git commit -m "test(all): appended standalone coverage across dependent nodes isolating physical behavior securely checks"
type output.log
