pragma solidity 0.4.18;

contract Owned {
    address public owner;
    address public newOwner;

    event OwnerUpdate(address _prevOwner, address _newOwner);

    function Owned()
        internal
    {
        owner = msg.sender;
    }

    modifier onlyOwner {
        assert(msg.sender == owner);

        _;
    }

    /// @dev allows transferring the contract ownership
    /// the new owner still needs to accept the transfer
    /// can only be called by the contract owner
    /// @param _newOwner    new contract owner
    function transferOwnership(address _newOwner)
        public
        onlyOwner
    {
        require(_newOwner != owner);
        newOwner = _newOwner;
    }

    /// @dev used by a new owner to accept an ownership transfer
    function acceptOwnership()
        public
    {
        require(msg.sender == newOwner);
        OwnerUpdate(owner, newOwner);
        owner = newOwner;
        newOwner = 0x0;
    }
}
