import { describe, it, expect } from 'vitest';
import { Cl } from '@stacks/transactions';
import { initSimnet } from '@stacks/clarinet-sdk'; 

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

describe('Clout Prediction Market', () => {

  it('Flow: User predicts correctly, wins, and balance increases', () => {
    // 1. Create Market (ID 0)
    const createMarket = simnet.callPublicFn(
      'clout-prediction', 
      'create-market', 
      [Cl.stringAscii("Will STX hit $5?")], 
      deployer
    );
    expect(createMarket.result).toBeOk(Cl.uint(0));

    // 2. Place Prediction (Wallet 1 bets TRUE with 50 clout)
    const predict = simnet.callPublicFn(
      'clout-prediction',
      'predict',
      [Cl.uint(0), Cl.bool(true), Cl.uint(50)],
      wallet1
    );
    expect(predict.result).toBeOk(Cl.bool(true));

    // 3. Admin Resolves Market (Outcome is TRUE)
    const resolve = simnet.callPublicFn(
      'clout-prediction',
      'resolve-market',
      [Cl.uint(0), Cl.bool(true)],
      deployer
    );
    expect(resolve.result).toBeOk(Cl.bool(true));

    // 4. Claim Reward
    const claim = simnet.callPublicFn(
      'clout-prediction',
      'claim',
      [Cl.uint(0)],
      wallet1
    );
    expect(claim.result).toBeOk(Cl.bool(true));

    // 5. Verify Balance (Start 100 - 50 stake + 100 payout = 150)
    const getClout = simnet.callReadOnlyFn(
      'clout-prediction',
      'get-user-clout',
      [Cl.standardPrincipal(wallet1)],
      deployer
    );
    expect(getClout.result).toBeOk(Cl.uint(150));
  });

  it('Security: User CANNOT claim the same reward twice', () => {
    // Setup: Create, Predict, Resolve
    simnet.callPublicFn('clout-prediction', 'create-market', [Cl.stringAscii("Double Claim Test")], deployer);
    simnet.callPublicFn('clout-prediction', 'predict', [Cl.uint(1), Cl.bool(true), Cl.uint(50)], wallet1);
    simnet.callPublicFn('clout-prediction', 'resolve-market', [Cl.uint(1), Cl.bool(true)], deployer);

    // 1. First Claim (Valid)
    const claim1 = simnet.callPublicFn('clout-prediction', 'claim', [Cl.uint(1)], wallet1);
    expect(claim1.result).toBeOk(Cl.bool(true));

    // 2. Second Claim (Must Fail)
    const claim2 = simnet.callPublicFn('clout-prediction', 'claim', [Cl.uint(1)], wallet1);
    // Expect ERR_ALREADY_CLAIMED (u105)
    expect(claim2.result).toBeErr(Cl.uint(105));
  });

  it('Flow: User predicts incorrectly and loses stake', () => {
    // Setup: Create Market
    simnet.callPublicFn('clout-prediction', 'create-market', [Cl.stringAscii("Losing Test")], deployer);

    // 1. Wallet 2 bets FALSE (Wrong!)
    const predict = simnet.callPublicFn('clout-prediction', 'predict', [Cl.uint(2), Cl.bool(false), Cl.uint(50)], wallet2);
    expect(predict.result).toBeOk(Cl.bool(true));

    // 2. Resolve Market (Outcome is TRUE)
    simnet.callPublicFn('clout-prediction', 'resolve-market', [Cl.uint(2), Cl.bool(true)], deployer);

    // 3. Claim (Acknowledging the loss)
    const claim = simnet.callPublicFn('clout-prediction', 'claim', [Cl.uint(2)], wallet2);
    // Should return (ok false) -> Transaction succeeds, but user lost
    expect(claim.result).toBeOk(Cl.bool(false));

    // 4. Verify Balance (Start 100 - 50 stake = 50 remaining)
    const getClout = simnet.callReadOnlyFn(
      'clout-prediction', 
      'get-user-clout', 
      [Cl.standardPrincipal(wallet2)], 
      deployer
    );
    expect(getClout.result).toBeOk(Cl.uint(50));
  });
});
