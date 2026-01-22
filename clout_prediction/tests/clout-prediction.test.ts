import { describe, it, expect } from 'vitest';
import { Cl } from '@stacks/transactions';
import { initSimnet } from '@stacks/clarinet-sdk';

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;

describe('Clout Prediction Market', () => {

  it('Flow: User predicts correctly, wins, and balance increases', () => {
    // 1. Create Market (ID 0)
    const createResponse = simnet.callPublicFn(
      'clout-prediction', 
      'create-market', 
      [Cl.stringAscii("Will STX hit $5?")], 
      deployer
    );
    expect(createResponse.result).toBeOk(Cl.uint(0));

    // 2. Place Prediction (Wallet 1 bets TRUE with 50 clout)
    const predictResponse = simnet.callPublicFn(
      'clout-prediction',
      'predict',
      [Cl.uint(0), Cl.bool(true), Cl.uint(50)],
      wallet1
    );
    expect(predictResponse.result).toBeOk(Cl.bool(true));

    // 3. Admin Resolves Market (Outcome is TRUE)
    const resolveResponse = simnet.callPublicFn(
      'clout-prediction',
      'resolve-market',
      [Cl.uint(0), Cl.bool(true)],
      deployer
    );
    expect(resolveResponse.result).toBeOk(Cl.bool(true));

    // 4. Claim Reward
    const claimResponse = simnet.callPublicFn(
      'clout-prediction',
      'claim',
      [Cl.uint(0)],
      wallet1
    );
    expect(claimResponse.result).toBeOk(Cl.bool(true));

    // 5. Verify Balance (Start 100 - 50 stake + 100 payout = 150)
    const balanceResponse = simnet.callReadOnlyFn(
      'clout-prediction',
      'get-user-clout',
      [Cl.standardPrincipal(wallet1)],
      deployer
    );
    expect(balanceResponse.result).toBeOk(Cl.uint(150));

    // 6. Verify Market Count (Should be 1 because we created market u0)
    const countResponse = simnet.callReadOnlyFn(
      'clout-prediction',
      'get-last-market-id',
      [],
      deployer
    );
    expect(countResponse.result).toBeOk(Cl.uint(1));
  });
});