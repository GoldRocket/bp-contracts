pragma solidity 0.4.18;

contract Migrations {
    address public owner;
    uint public lastCompletedMigration;

    modifier onlyOwner() {
        require(msg.sender == owner);
        
        _;
    }

    function Migrations()
        public
    {
        owner = msg.sender;
    }

    function setCompleted(uint completed)
        public
        onlyOwner
    {
        lastCompletedMigration = completed;
    }

    function upgrade(address newAddress)
        public
        onlyOwner
    {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(lastCompletedMigration);
    }
}
