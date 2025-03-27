const { loadAreaData, saveAreaData } = require('./config');
const { showCreateAreaForm } = require('./form');
const { isInArea } = require('./utils');
const { getPlayerData } = require('./playerDataManager');
const { initDatabase } = require('./database');
const { getDbSession } = require('./database');
const { loadConfig } = require('./configManager');
const { buildSpatialIndex } = require('./spatialIndex'); // 引入空间索引构建函数
const {logDebug, logInfo, logWarning, logError } = require('./logger');
let playerCurrentAreas = {};
let areaData = {};
let spatialIndex = {}; // 添加变量来存储空间索引
// 初始化时连接数据库
function initializePlugin() {
    // 初始化数据库
    if (initDatabase()) {
        logger.info("区域系统数据库初始化成功");
        areaData = loadAreaData();
        spatialIndex = buildSpatialIndex(areaData); // 初始化时构建索引
        const { init: initToolSelector } = require('./toolSelector');
        initToolSelector();
        const { loadAreaAdmins } = require('./areaAdmin');
        loadAreaAdmins();
    }
}



function getAreaData() {
    return areaData;
}

function initializeCommands() {
    const { registerCommands } = require('./command');
    registerCommands(areaData, 
        (pl, point1, point2) => {
            showCreateAreaForm(pl, point1, point2, areaData, getPlayerData(), saveAreaData, updateAreaData, checkPlayerArea);
        }, 
        saveAreaData
    );
    require('./eventHandler');
}

function updateAreaData(newAreaData) {
    areaData = newAreaData;
    spatialIndex = buildSpatialIndex(areaData); // 更新数据时重建索引

    // 自动检查所有在线玩家的位置
    let players = mc.getOnlinePlayers();
    players.forEach(checkPlayerArea);
}

// 服务器启动时注册命令
setTimeout(initializeCommands, 0);

function checkPlayerArea(pl) {
    const { getPlayerSettings } = require('./playerSettings');
    const { getPriorityAreasAtPosition } = require('./utils'); 
    const settings = getPlayerSettings(pl.uuid);

    const pos = pl.pos;
    if (!pos || pos.dimid === undefined || pos.dimid === null) { // 增加玩家位置有效性检查
        // logDebug(`玩家 ${pl.name} 位置无效或缺少维度，跳过区域检查`);
        return; // 如果位置无效，则不进行检查
    }

    // 检查上次显示时间
    const now = Date.now();
    if (!pl._lastAreaDisplay) {
        pl._lastAreaDisplay = 0;
    }
    const previousAreaId = playerCurrentAreas[pl.uuid];

    // 使用空间索引查询获取该位置的所有区域（已按优先级排序）
    // 注意：这里需要将 spatialIndex 传递给 getPriorityAreasAtPosition
    // 我们将在下一步修改 utils.js 中的 getPriorityAreasAtPosition 函数来接收它
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex); // 传递 spatialIndex

    if(areasAtPos.length > 0) {
        // 获取优先级最高的区域（子区域）
        const priorityArea = areasAtPos[0];
        const currentAreaId = priorityArea.id;
        const currentAreaName = priorityArea.area.name;
        
        // 区域变化时更新玩家当前区域ID
        if(previousAreaId !== currentAreaId) {
            playerCurrentAreas[pl.uuid] = currentAreaId;
            
            // 标题显示 - 只在区域变化时显示，不受冷却时间限制
            if(settings.displayTitle) {
                pl.setTitle(`§e你已进入区域`, 2, 10, 40, 10);
                pl.setTitle(`§b${currentAreaName}`, 3, 10, 40, 10);
                pl._lastAreaDisplay = now; // 更新显示时间（放在显示之后）
            }
        }
        
        // ActionBar显示 - 显示子区域和主区域信息
        if(settings.displayActionBar) {
            let displayText = `§e当前位置: §b${currentAreaName}`;
            
            // 如果是子区域，添加主区域信息
            if(priorityArea.isSubarea && priorityArea.parentAreaId) {
                const parentArea = areaData[priorityArea.parentAreaId];
                if(parentArea) {
                    displayText += ` §7(属于 §f${parentArea.name}§7)`;
                }
            }
            
            pl.setTitle(displayText, 4, 3, 50, 4);
        }
    } else {
        // 离开所有区域
        
        // 清除ActionBar
        if(settings.displayActionBar) {
            pl.sendText("", 5); // type 5 清除 action bar
        }
        // 重置玩家当前区域状态，以便下次进入时能触发标题显示
        if (playerCurrentAreas[pl.uuid] !== undefined) {
             playerCurrentAreas[pl.uuid] = undefined;
             // 可选：如果离开区域也需要提示，可以在这里添加 pl.setTitle("", 0); 来清除标题
        }
    }
}

mc.listen("onLeft", (pl) => {
    delete playerCurrentAreas[pl.uuid];
});

// 定时检查玩家位置并显示区域信息
setInterval(() => {
    let players = mc.getOnlinePlayers();
    players.forEach(checkPlayerArea);
}, 2000);

initializePlugin();

// 添加一个函数来获取当前的 spatialIndex
function getSpatialIndex() {
    return spatialIndex;
}

module.exports = {
    getAreaData,
    updateAreaData,
    checkPlayerArea,
    getSpatialIndex, // 导出获取索引的函数
};
