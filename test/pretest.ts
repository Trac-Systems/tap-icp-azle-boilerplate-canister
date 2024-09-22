import { execSync } from 'child_process';

function pretest(): void {
    execSync(`dfx canister uninstall-code tapswap || true`, {
        stdio: 'inherit'
    });

    execSync(`dfx deploy tapswap`, {
        stdio: 'inherit'
    });

    execSync(`dfx generate tapswap`, {
        stdio: 'inherit'
    });
}

pretest();
