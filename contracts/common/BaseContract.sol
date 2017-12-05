pragma solidity 0.4.18;

contract BaseContract {
    modifier greaterThanZero(uint256 _amount) {
        require(_amount > 0);

        _;
    }

    modifier isZero(uint256 _amount) {
        require(_amount == 0);

        _;
    }

    modifier nonZero(uint256 _amount) {
        require(_amount != 0);

        _;
    }

    modifier notThis(address _address) {
        require(_address != address(this));

        _;
    }

    modifier onlyIf(bool condition) {
        require(condition);

        _;
    }

    modifier validIndex(uint256 arrayLength, uint256 index) {
        requireValidIndex(arrayLength, index);

        _;
    }

    modifier validAddress(address _address) {
        require(_address != 0x0);

        _;
    }

    modifier validString(string value) {
        require(bytes(value).length > 0);

        _;
    }

    // mitigate short address attack
    // http://vessenes.com/the-erc20-short-address-attack-explained/
    modifier validParamData(uint256 numParams) {
        uint256 expectedDataLength = (numParams * 32) + 4;
        assert(msg.data.length == expectedDataLength);

        _;
    }

    function requireValidIndex(uint256 arrayLength, uint256 index)
        internal
        pure
    {
        require(index >= 0 && index < arrayLength);
    }
}
