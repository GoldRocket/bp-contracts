pragma solidity 0.4.18;

import "../BPCSmartTokenSale.sol";

contract BPCSmartTokenSaleTestHarness is BPCSmartTokenSale {
    function BPCSmartTokenSaleTestHarness(uint256 startTime)
        public
        BPCSmartTokenSale(startTime)
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
