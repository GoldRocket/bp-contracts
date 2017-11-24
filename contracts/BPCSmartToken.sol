pragma solidity 0.4.18;

import "./bancor/SmartToken.sol";

contract BPCSmartToken is SmartToken {
    function BPCSmartToken()
        public
        SmartToken("BlitzPredict", "BPZ", 18)
    {
        disableTransfers(true);
    }
}
