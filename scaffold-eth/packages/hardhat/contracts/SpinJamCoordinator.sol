pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./SpinJamVRFv2Consumer.sol";

// import "@openzeppelin/contracts/access/Ownable.sol";
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract SpinJamCoordinator is ReentrancyGuard, AccessControl {
    SpinJamVRFv2Consumer oracle;
    string public purpose = "Building Unstoppable Apps!!!";
    // next game is in 60 secs
    uint256 nextGameTime = 60;
    // game schedule is 0 or the time the game starts
    uint256[2] public gameSchedule = [block.timestamp + nextGameTime, 0];
    // gameToPlayers maps the game start time to those who have rsvped
    mapping(uint256 => address[]) gameToPlayers;
    // gameToRequestRandomNumId maps the game to the random number request id
    mapping(uint256 => uint256) gameToRequestRandomNumId;
    // allowedRefund maps the player to whether that player is allowed a refund
    mapping(address => bool) allowedRefund;
    uint256 costToPlay = 1 ether / 10000;
    // ranking maps users to their win ranking
    // storing off chain the players who have played and who is in the lead
    // otherwise we'd have to keep track of that
    mapping(address => int256) public ranking;

    mapping(address => bool) public cheaters;

    constructor(address oracleAddr) payable {
        oracle = SpinJamVRFv2Consumer(oracleAddr);
    }

    function getGameToPlayers(uint256 game)
        public
        view
        returns (address[] memory)
    {
        return gameToPlayers[game];
    }

    function setSchedule(uint256 _index, uint256 value) public {
        require(!cheaters[msg.sender], "Cheaters can't set schedules");
        require(_index < 2, "index out of bounds");
        require(gameSchedule[_index] == 0, "can't reschedule a scheduled game");
        gameSchedule[_index] = value;
    }

    function rsvpForGame(uint256 game) public payable {
        require(!cheaters[msg.sender], "Cheaters can't play");
        require(game < 2, "index out of bounds");
        require(
            block.timestamp < gameSchedule[game],
            "can't rsvp for the game after it already started"
        );
        require(
            allowedRefund[msg.sender] || msg.value >= costToPlay,
            "lacking in sufficient funds to rsvp"
        );
        require(
            allowedRefund[msg.sender] || msg.value >= costToPlay,
            "lacking in sufficient funds to rsvp"
        );
        allowedRefund[msg.sender] = false;
        gameToPlayers[gameSchedule[game]].push(msg.sender);
    }

    function refund() public {
        require(allowedRefund[msg.sender], "no refund available");
        allowedRefund[msg.sender] = false;
        payable(msg.sender).transfer(costToPlay);
    }

    function endGame(
        uint256 game,
        address[] memory whoIsHere,
        int256[] memory whatTheirScoreIs
    ) public {
        require(game < 2, "index out of bounds");
        require(
            block.timestamp > gameSchedule[game],
            "can't end the game before it's start time"
        );
        require(
            whoIsHere.length == whatTheirScoreIs.length,
            "received different amount of scores to people playing"
        );
        for (uint256 i = 0; i < whoIsHere.length; i++) {
            allowedRefund[whoIsHere[i]] = true;
            ranking[whoIsHere[i]] += whatTheirScoreIs[i];
        }
        gameSchedule[game] = block.timestamp + nextGameTime;
    }

    function backOutOfGame(uint256 game) public {
        require(game < 2, "index out of bounds");
        require(
            block.timestamp < gameSchedule[game],
            "can't back out of the game after it started"
        );
        address[] memory players = gameToPlayers[gameSchedule[game]];
        for (uint256 i = 0; i < players.length; i++) {
            if (msg.sender == players[i]) {
                gameToPlayers[gameSchedule[game]][i] = address(0);
                payable(msg.sender).transfer(costToPlay);
                return;
            }
        }
        revert("player not found");
    }

    function accuse(address accused) public {
        require(!cheaters[msg.sender], "Cheaters can't accuse");
        cheaters[accused] = true;
    }

    function setTeams(uint256 game) public {
        require(
            gameToRequestRandomNumId[gameSchedule[game]] == 0,
            "teams already set"
        );
        gameToRequestRandomNumId[gameSchedule[game]] = oracle
            .requestRandomWords();
    }

    function getTeams(uint256 game) public view returns (uint256) {
        require(
            gameToRequestRandomNumId[gameSchedule[game]] != 0,
            "teams not generated, call setTeams or submit a valid game"
        );
        return
            oracle.requestToNums(gameToRequestRandomNumId[gameSchedule[game]]);
    }

    function setTeamsLocalHost(uint256 game) public {
        require(
            gameToRequestRandomNumId[gameSchedule[game]] == 0,
            "teams already set"
        );
        gameToRequestRandomNumId[gameSchedule[game]] = block.timestamp;
    }

    function getTeamsLocalHost(uint256 game) public view returns (uint256) {
        require(
            gameToRequestRandomNumId[gameSchedule[game]] != 0,
            "teams not generated, call setTeams or submit a valid game"
        );
        return gameToRequestRandomNumId[gameSchedule[game]];
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function verify(
        address _signer,
        uint256 gameTime,
        string memory _message,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 messageHash = getMessageHash(gameTime, _message);
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return recoverSigner(ethSignedMessageHash, signature) == _signer;
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
        public
        pure
        returns (bytes32)
    {
        /*
        Signature is produced by signing a keccak256 hash with the following format:
        "\x19Ethereum Signed Message\n" + len(msg) + msg
        */
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
    }

    function getMessageHash(uint256 gameTime, string memory _message)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    _message /**, gameTime*/
                )
            );
    }

    function endGameWithSig(
        uint256 game,
        string memory message,
        bytes[] memory signatures,
        address[] memory whoIsHere,
        int256[] memory whatTheirScoreIs
    ) public {
        require(game < 2, "index out of bounds");
        require(
            block.timestamp > gameSchedule[game],
            "can't end the game before it's start time"
        );
        require(
            whoIsHere.length == whatTheirScoreIs.length,
            "received different amount of scores to people playing"
        );

        for (uint256 i = 0; i < whoIsHere.length; i++) {
            require(
                verify(
                    whoIsHere[i],
                    gameSchedule[game],
                    message,
                    signatures[i]
                ),
                "invalid signiture"
            );
            allowedRefund[whoIsHere[i]] = true;
            ranking[whoIsHere[i]] += whatTheirScoreIs[i];
        }
        gameSchedule[game] = block.timestamp + nextGameTime;
    }

    // to support receiving ETH by default
    receive() external payable {}

    fallback() external payable {}
}
