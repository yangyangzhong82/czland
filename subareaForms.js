// subareaForms.js

const {  saveAreaData } = require('./config');
const { isInArea, checkNewAreaOverlap, isAreaWithinArea } = require('./utils');
const { getPlayerData } = require('./playerDataManager');
const { checkPermission } = require('./permission');
const { getAreaData } = require('./czareaprotection');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
function showSubAreaManageForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    // 如果是子区域,不允许再创建子区域
    if(area.isSubarea) {
        player.tell("§c子区域不能再创建子区域！");
        return;
    }
    
    if(!checkPermission(player, areaData, areaId, "subareaManage")) {
        player.tell("§c你没有管理子区域的权限！");
        return;
    }
    
    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 子区域管理`);
    fm.addButton("创建子区域");
    fm.addButton("查看子区域列表");
    
    player.sendForm(fm, (player, id) => {
        if(id === null) return;
        
        switch(id) {
            case 0:
                showCreateSubAreaForm(player, areaId);
                break;
            case 1:
                showSubAreaListForm(player, areaId);
                break;
        }
    });
}

function showCreateSubAreaForm(player, parentAreaId) {
    const playerData = getPlayerData();
    if(!playerData[player.uuid] || !playerData[player.uuid].pos1 || !playerData[player.uuid].pos2) {
        player.tell("§c请先使用/area pos1和pos2设置子区域范围！");
        return;
    }
    
    const point1 = playerData[player.uuid].pos1;
    const point2 = playerData[player.uuid].pos2;
    
    const fm = mc.newCustomForm();
    fm.setTitle("创建子区域");
    fm.addInput("子区域名称", "请输入名称");
    fm.addLabel(`范围：从(${point1.x}, ${point1.y}, ${point1.z})到(${point2.x}, ${point2.y}, ${point2.z})`);
    
    player.sendForm(fm, (player, data) => {
        if(data === null) return;
        
        const name = data[0].trim();
        if(!name) {
            player.tell("§c子区域名称不能为空！");
            return;
        }
        
        const result = createSubArea(parentAreaId, name, point1, point2, player);
        if(result.success) {
            player.tell(`§a子区域创建成功！ID: ${result.subareaId}`);
            // 清除临时数据
            delete playerData[player.uuid].pos1;
            delete playerData[player.uuid].pos2;
        } else {
            player.tell(`§c${result.message}`);
        }
    });
}

function createSubArea(parentAreaId, name, point1, point2, player) {
    const areaData = getAreaData();
    const parentArea = areaData[parentAreaId];
    
    if(!parentArea) {
        return {
            success: false,
            message: "父区域不存在！"
        };
    }
    const { loadConfig } = require('./configManager');
    const config = loadConfig();
    const { checkAreaSizeLimits } = require('./utils');
    // 检查区域大小限制
    const sizeCheck = checkAreaSizeLimits(point1, point2, config, true); // true表示子区域
    
    if (!sizeCheck.valid) {
        return {
            success: false,
            message: sizeCheck.message
        };
    }
    // 验证子区域是否在父区域内
    const subArea = {
        point1: point1,
        point2: point2,
        dimid: point1.dimid
    };
    
    const parentAreaObj = {
        point1: parentArea.point1,
        point2: parentArea.point2,
        dimid: parentArea.dimid
    };
    
    if(!isAreaWithinArea(subArea, parentAreaObj)) {
        return {
            success: false,
            message: "子区域必须完全在父区域内！"
        };
    }
    
    // 检查是否与其他区域重叠
    const areasToCheck = { ...areaData };
    delete areasToCheck[parentAreaId];
    
    const overlapCheck = checkNewAreaOverlap(subArea, areasToCheck);
    if(overlapCheck.overlapped) {
        return {
            success: false,
            message: `与现有区域 "${overlapCheck.overlappingArea.name}" 重叠！`
        };
    }
    
    // 创建子区域ID
    const parentIdParts = parentAreaId.split('_');
    const parentShortId = parentIdParts[parentIdParts.length - 1];
    const randomId = Math.random().toString(36).substring(2, 8);
    const subareaId = `sub_${parentShortId}_${randomId}`;    
    // 创建子区域数据
    areaData[subareaId] = {
        name: name,
        point1: {
            x: point1.x,
            y: point1.y,
            z: point1.z
        },
        point2: {
            x: point2.x,
            y: point2.y,
            z: point2.z
        },
        dimid: point1.dimid,
        xuid: player.xuid,
        uuid: player.uuid,
        playerName: player.name,
        createTime: new Date().getTime(),
        isSubarea: true,
        parentAreaId: parentAreaId
    };
    
    // 更新父区域的子区域列表
    if(!parentArea.subareas) {
        parentArea.subareas = {};
    }
    parentArea.subareas[subareaId] = true;
    
    // 保存数据
    if(saveAreaData(areaData)) {
        return {
            success: true,
            subareaId: subareaId
        };
    } else {
        return {
            success: false,
            message: "保存数据失败！"
        };
    }
}

function showSubAreaListForm(player, parentAreaId) {
    const areaData = getAreaData();
    const parentArea = areaData[parentAreaId];
    
    if(!parentArea) {
        player.tell("§c父区域不存在！");
        return;
    }
    
    const subareas = parentArea.subareas || {};
    
    const fm = mc.newSimpleForm();
    fm.setTitle(`${parentArea.name} - 子区域列表`);
    
    let hasSubareas = false;
    let validSubareas = [];
    
    // 收集有效的子区域
    for(let subareaId in subareas) {
        if(areaData[subareaId]) {
            hasSubareas = true;
            validSubareas.push({
                id: subareaId,
                name: areaData[subareaId].name
            });
        } else {
            delete parentArea.subareas[subareaId];
        }
    }
    
    if(!hasSubareas) {
        if(Object.keys(parentArea.subareas).length === 0) {
            saveAreaData(areaData);
        }
        
        player.tell("§e该区域没有子区域，请先创建！");
        return;
    }
    
    validSubareas.sort((a, b) => a.name.localeCompare(b.name));
    
    for(let subarea of validSubareas) {
        const area = areaData[subarea.id];
        const p1 = area.point1;
        const p2 = area.point2;
        fm.addButton(`${subarea.name}\n§7位置: (${p1.x},${p1.y},${p1.z}) - (${p2.x},${p2.y},${p2.z})`);
    }
    
    fm.addButton("§l§c返回上级菜单");
    
    player.sendForm(fm, (player, id) => {
        if(id === null) return;
        
        if(id === validSubareas.length) {
            const { showAreaOperateForm } = require('./mainForm');
            showAreaOperateForm(player, parentAreaId);
            return;
        }
        
        const selectedSubareaId = validSubareas[id].id;
        
        if(areaData[selectedSubareaId]) {
            const { showAreaOperateForm } = require('./mainForm');
            showAreaOperateForm(player, selectedSubareaId);
        }
    });
}

function initializeSubareaRecords() {
    const areaData = getAreaData();
    let updated = false;
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        
        if(area.isSubarea && area.parentAreaId) {
            const parentArea = areaData[area.parentAreaId];
            if(parentArea) {
                if(!parentArea.subareas) {
                    parentArea.subareas = {};
                    updated = true;
                }
                
                if(!parentArea.subareas[areaId]) {
                    parentArea.subareas[areaId] = true;
                    updated = true;
                }
            }
        }
        
        if(!area.isSubarea && !area.subareas) {
            area.subareas = {};
            updated = true;
        }
    }
    
    if(updated) {
        saveAreaData(areaData);
        logDebug("子区域记录已初始化");
    }
}

module.exports = {
    showSubAreaManageForm,
    initializeSubareaRecords,
};