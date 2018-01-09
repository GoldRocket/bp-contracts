pragma solidity 0.4.18;

contract IToken { 
    function totalSupply()
        public view
        returns (uint);

    function balanceOf(address _owner)
        public view
        returns (uint);

    function transfer(address _to, uint _value)
        public
        returns (bool);

    function transferFrom(address _from, address _to, uint _value)
        public
        returns (bool);

    function approve(address _spender, uint _value)
        public
        returns (bool);

    function allowance(address _owner, address _spender)
        public view
        returns (uint);
}
