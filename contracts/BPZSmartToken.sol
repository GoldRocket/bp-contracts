pragma solidity 0.4.18;

import "./common/SmartToken.sol";

contract BPZSmartToken is SmartToken {
    function BPZSmartToken()
        public
        SmartToken("BlitzPredict", "BPZ", 18)
    {
    }
}
