# TAP Protocol ICP/Azle Boilerplate Canister

-   [Installation](#installation)
-   [Deployment](#deployment)

This boilerplate enables you to start with a smart contract (canister) on ICP for TAP Protocol related computations.

You can use your canister as both, privilege and token authority and use ICP's Bitcoin integration to perform computations on L1.

To allow the development with a familiar platform, this boilerplate utilizes Azle.

Azle helps you to build secure decentralized/replicated servers in TypeScript or JavaScript, as well as NodeJS on [ICP](https://internetcomputer.org/). The current replication factor is [13-40 times](https://dashboard.internetcomputer.org/subnets).

Please remember that Azle is in beta and thus it may have unknown security vulnerabilities due to the following:

-   Azle is built with various software packages that have not yet reached maturity
-   Azle does not yet have multiple independent security reviews/audits
-   Azle does not yet have many live, successful, continuously operating applications deployed to ICP

A great Azle resource is located at [The Azle Book](https://demergent-labs.github.io/azle/the_azle_book.html).

Make sure to read the comments in the boilerplace code. Especially the files index.ts, lib/incoming.ts, lib/queue.ts and lib/ticker.ts give an insight on how to utilize the concepts of this canister boilerplate.

## Installation

> Windows is only supported through a Linux virtual environment of some kind, such as [WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

You will need [Node.js 20](#nodejs-20) (or later) and [dfx](#dfx) to develop ICP applications with Azle:

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
DFX_VERSION=0.22.0 sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
```

Check that the installation went smoothly by looking for clean output from the following command:

```bash
dfx --version
```

## Deployment

To create and deploy a simple sample application called `tap-icp-boilerplate`:

```bash
# cd into this project's root folder
cd tap-icp-boilerplate
```

```bash
# copy and rename the config-dist.ts file
cp config-dist.ts config.ts
```

```bash
# adjust the config file to your needs (totally fine to start with default setup)
vi config.ts
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

To allow built-in ETH RPC calls on your local ICP replica, perform the below in a separate terminal inside the `tap-icp-boilerplate` directory:

```javascript
// add this in your dfx.json to enable evm_rpc IF not existing yet
{
  "canisters": {
    "evm_rpc": {
      "type": "pull",
      "id": "7hfb6-caaaa-aaaar-qadga-cai"
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

Please note that you won't need to perform the step above on ICP's mainnet.
