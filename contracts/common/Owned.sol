pragma solidity 0.4.18;

import "./BaseContract.sol";

contract Owned is BaseContract {
    address public owner;
    address public newOwner;

    event OwnerUpdate(address _prevOwner, address _newOwner);

    function Owned()
        internal
    {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);

        _;
    }

    /// @dev allows transferring the contract ownership
    /// the new owner still needs to accept the transfer
    /// can only be called by the contract owner
    /// @param _newOwner    new contract owner
    function transferOwnership(address _newOwner)
        public
        validParamData(1)
        onlyOwner
        onlyIf(_newOwner != owner)
    {
        newOwner = _newOwner;
    }

    /// @dev used by a new owner to accept an ownership transfer
    function acceptOwnership()
        public
        validParamData(0)
        onlyIf(msg.sender == newOwner)
    {
        OwnerUpdate(owner, newOwner);
        owner = newOwner;
        newOwner = 0x0;
    }
}
