// czland.js
// 导入模块
const { loadAreaData, saveAreaData } = require('./config');
const { showCreateAreaForm } = require('./form');
const { isInArea } = require('./utils');
const { getPlayerData } = require('./playerDataManager');


let playerCurrentAreas = {};

// 初始化区域数据
let areaData = loadAreaData();

function getAreaData() {
    return areaData;
}

// 延迟注册命令，等待模块完全加载
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
    
    // 检查上次显示时间
    const now = Date.now();
    if (!pl._lastAreaDisplay) {
        pl._lastAreaDisplay = 0;
    }
    
    // 获取该位置的所有区域（已按优先级排序）
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData);
    const previousAreaId = playerCurrentAreas[pl.uuid];
    
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
        if(previousAreaId !== null) {
            playerCurrentAreas[pl.uuid] = null;
            
            // 在离开时检查冷却时间是否已过
            if(settings.displayTitle && (now - pl._lastAreaDisplay >= settings.displayCooldown)) {
                pl.setTitle("§e你已离开保护区域", 2, 10, 40, 10);
                pl.setTitle("", 3, 10, 40, 10);
                pl._lastAreaDisplay = now; // 更新显示时间
            }
        }
        
        // 清除ActionBar
        if(settings.displayActionBar) {
            pl.sendText("", 5);
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

module.exports = {
    getAreaData,
    updateAreaData,
    checkPlayerArea // 导出检查函数供其他模块使用
};