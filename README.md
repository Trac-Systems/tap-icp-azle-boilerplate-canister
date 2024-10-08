# TAP ICP/Azle Boilerplate Canister

-   [Installation](#installation)
-   [Deployment](#deployment)

Azle helps you to build secure decentralized/replicated servers in TypeScript or JavaScript on [ICP](https://internetcomputer.org/). The current replication factor is [13-40 times](https://dashboard.internetcomputer.org/subnets).

Please remember that Azle is in beta and thus it may have unknown security vulnerabilities due to the following:

-   Azle is built with various software packages that have not yet reached maturity
-   Azle does not yet have multiple independent security reviews/audits
-   Azle does not yet have many live, successful, continuously operating applications deployed to ICP

## Installation

> Windows is only supported through a Linux virtual environment of some kind, such as [WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

You will need [Node.js 20](#nodejs-20) and [dfx](#dfx) to develop ICP applications with Azle:

### Node.js 20

It's recommended to use nvm to install Node.js 20:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Restart your terminal and then run:

```bash
nvm install 20
```

Check that the installation went smoothly by looking for clean output from the following command:

```bash
node --version
```

### dfx

Install the dfx command line tools for managing ICP applications:

```bash
DFX_VERSION=0.21.0 sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
```

Check that the installation went smoothly by looking for clean output from the following command:

```bash
dfx --version
```

## Deployment

To create and deploy a simple sample application called `tapswap`:

```bash
# create a new default project called tapswap
npx azle new tap-icp-boilerplate
cd tap-icp-boilerplate
```

```bash
# install all npm dependencies including azle
npm install
```

```bash
# install the azle dfx extension
npx azle install-dfx-extension
```

```bash
# start up a local ICP replica
dfx start --clean
```

In a separate terminal in the `tap-icp-boilerplate` directory:

```bash
# deploy your canister
dfx deploy
```

To allow built-in ETH RPC call, perform the below in a separate terminal in the `tapbridge` directory:

```javascript
// add this in your dfx.json to enable evm_rpc IF not existing yet
{
  "canisters": {
    "evm_rpc": {
      "type": "pull",
      "id": "7hfb6-caaaa-aaaar-qadga-cai",
    }
  }
}

```

```bash
# perform this once for evm_rpc to work with your local ICP replica (assuming dfx start above has been done already)
dfx deps pull
dfx deps init evm_rpc --argument '(record { nodesInSubnet = 34 })'
dfx deps deploy
```
