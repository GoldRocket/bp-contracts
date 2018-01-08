pragma solidity 0.4.18;

import "../BPZSmartTokenSale.sol";

contract BPZSmartTokenSaleTestHarnessForFallback is BPZSmartTokenSale {
    bool public purchaseTokensCalled = false;

    function BPZSmartTokenSaleTestHarnessForFallback(uint256 startTime)
        public
        BPZSmartTokenSale(startTime)
    {
        startTime; // make solhint be quiet about empty function.
    }

    function purchaseTokens()
        public
        payable
    {
        purchaseTokensCalled = true;
    }
}
