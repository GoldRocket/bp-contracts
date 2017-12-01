pragma solidity 0.4.18;

import "../BPZSmartTokenSale.sol";

contract BPZSmartTokenSaleTestHarness is BPZSmartTokenSale {
    function BPZSmartTokenSaleTestHarness(uint256 startTime)
        public
        BPZSmartTokenSale(startTime)
    {
        startTime; // make solhint be quiet about empty function.
    }

    function forceSaleStart()
        public
        onlyOwner
    {
        startTime = now;
    }
}
