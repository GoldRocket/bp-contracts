pragma solidity 0.4.18;

import "./BaseContract.sol";
import "./SafeMath.sol";

// solhint-disable no-simple-event-func-name

// ERC20 Standard Token implementation
contract ERC20Token is BaseContract {
    using SafeMath for uint256;

    string public standard = "Token 0.1";
    string public name = "";
    string public symbol = "";
    uint8 public decimals = 0;
    uint256 public totalSupply = 0;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    event Transfer(address _from, address _to, uint256 _value);
    event Approval(address _owner, address _spender, uint256 _value);

    /// @dev constructor
    /// @param _name        token name
    /// @param _symbol      token symbol
    /// @param _decimals    decimal points, for display purposes
    function ERC20Token(string _name, string _symbol, uint8 _decimals)
        internal
        onlyValidString(_name)
        onlyValidString(_symbol)
    {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /// @dev send coins
    /// throws on any error rather then return a false flag to minimize user errors
    /// @param _to      target address
    /// @param _value   transfer amount
    /// @return true if the transfer was successful, false if it wasn't
    function transfer(address _to, uint256 _value)
        public
        validParamData(2)
        validAddress(_to)
        notThis(_to)
        returns (bool success)
    {
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        Transfer(msg.sender, _to, _value);
        return true;
    }

    /// @dev an account/contract attempts to get the coins
    /// throws on any error rather then return a false flag to minimize user errors
    /// @param _from    source address
    /// @param _to      target address
    /// @param _value   transfer amount
    /// @return true if the transfer was successful, false if it wasn't
    function transferFrom(address _from, address _to, uint256 _value)
        public
        validParamData(3)
        validAddress(_from)
        validAddress(_to)
        notThis(_to)
        returns (bool success)
    {
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        Transfer(_from, _to, _value);
        return true;
    }

    /// @dev allow another account/contract to spend some tokens on your behalf
    /// throws on any error rather then return a false flag to minimize user errors
    /// also, to minimize the risk of the approve/transferFrom attack vector
    /// (see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/)
    /// approve has to be called twice in 2 separate transactions
    /// once to change the allowance to 0 and secondly to change it to the new allowance value
    /// @param _spender approved address
    /// @param _value   allowance amount
    /// @return true if the approval was successful, false if it wasn't
    function approve(address _spender, uint256 _value)
        public
        validParamData(2)
        validAddress(_spender)
        onlyIf(_value == 0 || allowance[msg.sender][_spender] == 0)
        returns (bool success)
    {
        uint256 currentAllowance = allowance[msg.sender][_spender];

        return changeApprovalCore(_spender, currentAllowance, _value);
    }

    /// @dev Allow another account/contract to spend some tokens on your behalf
    /// Note: This method is protected against the approve/transferFrom attack vector
    /// (see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/)
    /// because the previous value and new value must both be specified.
    function changeApproval(address _spender, uint256 _previousValue, uint256 _value)
        public
        validParamData(3)
        validAddress(_spender)
        returns (bool success)
    {
        return changeApprovalCore(_spender, _previousValue, _value);
    }

    function changeApprovalCore(address _spender, uint256 _previousValue, uint256 _value)
        private
        onlyIf(allowance[msg.sender][_spender] == _previousValue)
        returns (bool success)
    {
        allowance[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);

        return true;
    }
}
