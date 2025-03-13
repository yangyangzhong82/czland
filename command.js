// command.js
// command.js
const { showMainForm } = require('./mainForm');
const { getPlayerData, setPlayerData } = require('./playerDataManager');

function registerCommands(areaData, showCreateAreaForm, saveAreaData) {
    const cmd = mc.newCommand("area", "区域管理命令", PermType.GameMasters);
    cmd.setAlias("ar");
    cmd.setEnum("AreaActions", ["pos1", "pos2", "create"]);
    cmd.setEnum("AreaSettings", ["settings"]);

    cmd.optional("action", ParamType.Enum, "AreaActions", 1);
    cmd.optional("name", ParamType.RawText);
    cmd.optional("settings", ParamType.Enum, "AreaSettings", 1);

    cmd.overload(["AreaActions"]);
    cmd.overload(["AreaActions", "name"]);
    cmd.overload(["AreaSettings"]);
    cmd.overload([]); 

    cmd.setCallback((_cmd, ori, out, res) => {
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

module.exports = {
    registerCommands
};