// command.js
// command.js
const { showMainForm } = require('./mainForm');
const { getPlayerData, setPlayerData } = require('./playerDataManager');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
function registerCommands(areaData, showCreateAreaForm, saveAreaData) {
    const cmd = mc.newCommand("area", "区域管理命令", PermType.GameMasters);
    cmd.setAlias("ar");
    cmd.setEnum("AreaActions", ["pos1", "pos2", "create"]);
    cmd.setEnum("AreaSettings", ["settings"]);
    cmd.setEnum("AdminActions", ["op", "deop", "admins"]);

    cmd.optional("action", ParamType.Enum, "AreaActions", 1);
    cmd.optional("name", ParamType.RawText);
    cmd.optional("settings", ParamType.Enum, "AreaSettings", 1);
    cmd.optional("adminAction", ParamType.Enum, "AdminActions", 1);
    cmd.optional("playerName", ParamType.String);

    cmd.overload(["AreaActions"]);
    cmd.overload(["AreaActions", "name"]);
    cmd.overload(["AreaSettings"]);
    cmd.overload(["AdminActions", "playerName"]);
    cmd.overload(["AdminActions"])
    cmd.overload([]); 

    cmd.setCallback((_cmd, ori, out, res) => {
        // 处理管理员命令
        if (res.adminAction) {
            // 只允许控制台或OP执行
            if (!ori.player || (ori.player && ori.player.permLevel >= 1)) {
                switch (res.adminAction) {
                    case "op":
                        handleAddAdmin(ori, out, res.playerName, areaData);
                        break;
                    case "deop":
                        handleRemoveAdmin(ori, out, res.playerName);
                        break;
                    case "admins":
                        handleListAdmins(ori, out);
                        break;
                }
                return;
            } else {
                return out.error("§c只有OP或控制台才能执行此命令！");
            }
        }
        
        // 确保有玩家对象才执行以下操作
        if (!ori.player) {
            return out.error("§c此命令必须由玩家执行！");
        }
        
        const pl = ori.player;
        
        if (res.settings === "settings") {
            const { showSettingsForm } = require('./settingsForm');
            showSettingsForm(pl);
            return;
        }
        
        // 如果没有参数，显示主界面
        if (!res.action) {
            showMainForm(pl);
            return;
        }
        
        switch(res.action) {
            case "pos1":
                handlePos1(pl, out);
                break;
            case "pos2":
                handlePos2(pl, out);
                break;
            case "create":
                handleCreate(pl, areaData, out, showCreateAreaForm, saveAreaData);
                break;
        }
    });
    cmd.setup(); 
}


function handlePos1(pl, out) {
    let pos1 = pl.pos;
    setPlayerData(pl.uuid, {
        pos1: {
            x: Math.floor(pos1.x),
            y: Math.floor(pos1.y),
            z: Math.floor(pos1.z),
            dimid: pos1.dimid,     
        }
    });
    return out.success(`§a已设置点1: x:${pos1.x} y:${pos1.y} z:${pos1.z} 维度:${pos1.dimid}`);
}

function handlePos2(pl, out) {
    let pos2 = pl.pos;
    setPlayerData(pl.uuid, {
        pos2: {
            x: Math.floor(pos2.x),
            y: Math.floor(pos2.y),
            z: Math.floor(pos2.z),
            dimid: pos2.dimid,      
        }
    });
    return out.success(`§a已设置点2: x:${pos2.x} y:${pos2.y} z:${pos2.z} 维度:${pos2.dimid}`);
}

function handleCreate(pl, areaData, out, showCreateAreaForm, saveAreaData) {
    const playerData = getPlayerData();
    if(!playerData[pl.uuid] || !playerData[pl.uuid].pos1 || !playerData[pl.uuid].pos2) {
        return out.error("§c请先设置两个点！");
    }
    
    let point1 = playerData[pl.uuid].pos1;
    let point2 = playerData[pl.uuid].pos2;
    
    if(point1.dimid !== point2.dimid) {
        return out.error("§c两个点必须在同一维度！");
    }
    
    // 使用传入的回调函数和saveAreaData
    showCreateAreaForm(pl, point1, point2, areaData, playerData, saveAreaData);
}

// 处理添加领地管理员的函数
function handleAddAdmin(ori, out, playerName, areaData) {
    if (!playerName) {
        return out.error("§c请指定玩家名称！");
    }
    
    // 使用新的查找玩家函数（支持离线玩家）
    const { findPlayerByName, addAreaAdmin, saveAreaAdmins } = require('./areaAdmin');
    const playerInfo = findPlayerByName(playerName);
    
    if (!playerInfo) {
        return out.error(`§c找不到玩家: ${playerName}`);
    }
    
    // 添加到领地管理员列表
    if (addAreaAdmin(playerInfo.uuid, playerInfo.name)) {
        // 保存管理员数据
        saveAreaAdmins();
        
        // 如果玩家在线，通知玩家
        if (playerInfo.isOnline) {
            const player = mc.getPlayer(playerInfo.uuid);
            if (player) {
                player.tell("§a你已被设置为领地管理员，拥有所有领地的管理权限！");
            }
        }
        
        return out.success(`§a已将玩家 ${playerInfo.name} 设置为领地管理员！${playerInfo.isOnline ? "" : "（离线玩家）"}`);
    } else {
        return out.error(`§c设置领地管理员失败，可能该玩家已经是管理员！`);
    }
}

// 新增：处理删除领地管理员的函数
function handleRemoveAdmin(ori, out, playerName) {
    if (!playerName) {
        return out.error("§c请指定玩家名称！");
    }
    
    const { findPlayerByName, removeAreaAdmin, saveAreaAdmins, isAreaAdmin, getAllAreaAdmins } = require('./areaAdmin');
    
    // 先尝试通过名称查找玩家
    const playerInfo = findPlayerByName(playerName);
    
    if (playerInfo) {
        // 如果找到了玩家，直接使用UUID删除
        if (removeAreaAdmin(playerInfo.uuid)) {
            saveAreaAdmins();
            
            // 如果玩家在线，通知玩家
            if (playerInfo.isOnline) {
                const player = mc.getPlayer(playerInfo.uuid);
                if (player) {
                    player.tell("§c你已被移除领地管理员权限！");
                }
            }
            
            return out.success(`§a已将玩家 ${playerInfo.name} 从领地管理员中移除！`);
        } else {
            return out.error(`§c该玩家不是领地管理员！`);
        }
    } else {
        // 如果通过名称找不到玩家，尝试在管理员列表中查找匹配的名称
        const admins = getAllAreaAdmins();
        let found = false;
        
        for (const uuid in admins) {
            if (admins[uuid].name.toLowerCase() === playerName.toLowerCase()) {
                if (removeAreaAdmin(uuid)) {
                    saveAreaAdmins();
                    found = true;
                    return out.success(`§a已将玩家 ${admins[uuid].name} 从领地管理员中移除！`);
                }
            }
        }
        
        if (!found) {
            return out.error(`§c找不到名为 ${playerName} 的领地管理员！`);
        }
    }
}

// 新增：处理列出所有领地管理员的函数
function handleListAdmins(ori, out) {
    const { getAllAreaAdmins } = require('./areaAdmin');
    const admins = getAllAreaAdmins();
    const adminCount = Object.keys(admins).length;
    
    if (adminCount === 0) {
        return out.success("§e当前没有领地管理员！");
    }
    
    let message = `§a当前共有 §6${adminCount}§a 名领地管理员：\n`;
    
    // 将管理员按添加时间排序
    const sortedAdmins = Object.entries(admins).sort((a, b) => a[1].addTime - b[1].addTime);
    
    sortedAdmins.forEach(([uuid, admin], index) => {
        const addDate = new Date(admin.addTime).toLocaleString();
        message += `§6${index + 1}. §e${admin.name} §7(添加时间: ${addDate})\n`;
    });
    
    return out.success(message);
}


module.exports = {
    registerCommands
};