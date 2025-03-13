// playerDataManager.js
// 创建一个对象用于存储玩家数据
let playerData = {};

// 获取玩家数据
function getPlayerData() {
    return playerData;
}

// 重置玩家数据
function resetPlayerData() {
    playerData = {};
}

// 设置某个玩家的数据
function setPlayerData(uuid, data) {
    if(!playerData[uuid]) {
        playerData[uuid] = {};
    }
    Object.assign(playerData[uuid], data);
}

module.exports = {
    getPlayerData,
    resetPlayerData,
    setPlayerData
};