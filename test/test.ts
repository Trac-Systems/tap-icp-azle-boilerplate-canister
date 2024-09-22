import { getCanisterId } from 'azle/dfx';
import { runTests } from 'azle/test';

import { createActor } from './dfx_generated/tapswap';
import { getTests } from './tests';

const helloWorldCanister = createActor(getCanisterId('tapswap'), {
    agentOptions: {
        host: 'http://127.0.0.1:8000'
    }
});

runTests(getTests(helloWorldCanister));
