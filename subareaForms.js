// subareaForms.js

const { saveAreaData } = require('./config');
// 导入 getAreaDepth, getAreaHierarchyPath, calculateAreaVolume, checkPlayerAreaLimits, checkOverlapWithRestrictedZones
const { isInArea, checkNewAreaOverlap, isAreaWithinArea, getAreaDepth, getAreaHierarchyPath, calculateAreaVolume, checkPlayerAreaLimits, checkOverlapWithRestrictedZones } = require('./utils');
const { getPlayerData } = require('./playerDataManager');
const { checkPermission } = require('./permission');
const { getAreaData } = require('./czareaprotection');
const { isAreaAdmin } = require('./areaAdmin'); // 导入 isAreaAdmin
const { logDebug, logInfo, logWarning, logError } = require('./logger');
function showSubAreaManageForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];

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
    const { updateAreaData } = require('./czareaprotection');  
    const areaData = getAreaData();
    const parentArea = areaData[parentAreaId];
    
    if(!parentArea) {
        return {
            success: false,
            message: "父区域不存在！"
        };
    }

    const { loadConfig } = require('./configManager'); // 加载配置
    const config = loadConfig();
    const { getAreaDepth } = require('./utils'); // 确保 getAreaDepth 可用

    // --- 子区域层级限制检查 (替换旧的深度检查) ---
    const parentDepth = getAreaDepth(parentAreaId, areaData);
    const newSubAreaDepth = parentDepth + 1; // 新子区域的深度 (主区域=0, 一级子=1, 二级子=2)

    logDebug(`尝试创建子区域 ${name}，父区域 ${parentAreaId} 深度: ${parentDepth}，新子区域深度: ${newSubAreaDepth}`);

    // 检查是否允许创建一级子区域 (新深度为 1)
    // 添加 !config.subAreaLevelLimits 检查以确保该配置项存在
    if (newSubAreaDepth === 1 && (!config.subAreaLevelLimits || config.subAreaLevelLimits.allowLevel2 === false)) {
        logInfo(`玩家 ${player.name} 尝试创建一级子区域 ${name} (深度 ${newSubAreaDepth})，但配置不允许 (allowLevel2: false)。`);
        return {
            success: false,
            message: "配置不允许创建一级子区域。"
        };
    }
    // 检查是否允许创建二级子区域 (新深度为 2)
    // 添加 !config.subAreaLevelLimits 检查以确保该配置项存在
    else if (newSubAreaDepth === 2 && (!config.subAreaLevelLimits || config.subAreaLevelLimits.allowLevel3 === false)) {
        logInfo(`玩家 ${player.name} 尝试创建二级子区域 ${name} (深度 ${newSubAreaDepth})，但配置不允许 (allowLevel3: false)。`);
        return {
            success: false,
            message: "配置不允许创建二级子区域。"
        };
    }
    // 检查是否超过最大允许深度 (新深度大于 2)
    else if (newSubAreaDepth > 2) {
        logInfo(`玩家 ${player.name} 尝试创建过深层级的子区域 ${name} (深度 ${newSubAreaDepth})。`);
        return {
            success: false,
            message: "无法创建更深层级的子区域（最多允许到三级）。" // 对应深度 2
        };
    }
    // --- 层级检查结束 ---

    // const { loadConfig } = require('./configManager'); // 已移到前面
    // const config = loadConfig(); // 已移到前面
    const { checkAreaSizeLimits } = require('./utils');
    // 检查区域大小限制，传入新子区域的深度 newSubAreaDepth
    const sizeCheck = checkAreaSizeLimits(point1, point2, config, true, newSubAreaDepth); // true表示子区域, newSubAreaDepth 是深度

    if (!sizeCheck.valid) {
        logInfo(`玩家 ${player.name} 创建子区域 ${name} 失败，大小不符合限制: ${sizeCheck.message}`);
        return {
            success: false,
            message: sizeCheck.message
        };
    }

    // --- 新增：检查玩家总区域数量和体积限制 ---
    // 区域管理员无视此限制
    if (!isAreaAdmin(player.uuid)) {
        const newSubAreaVolume = calculateAreaVolume(point1, point2);
        // 使用之前计算好的 newSubAreaDepth
        const playerLimitCheck = checkPlayerAreaLimits(player.xuid, newSubAreaDepth, newSubAreaVolume, areaData, config);
        if (!playerLimitCheck.valid) {
            logInfo(`玩家 ${player.name} 创建子区域 ${name} 失败，超出玩家限制: ${playerLimitCheck.message}`);
            return {
                success: false,
                message: playerLimitCheck.message
            };
        }
    }
    // --- 玩家限制检查结束 ---


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

    // --- 新增：根据配置检查子区域是否必须在父区域内 ---
    // 从完整的配置中读取 areaSizeLimits.subarea.allowSubareaOutsideParent
    if (config && config.areaSizeLimits && config.areaSizeLimits.subarea && !config.areaSizeLimits.subarea.allowSubareaOutsideParent) {
        if (!isAreaWithinArea(subArea, parentAreaObj)) {
            logInfo(`玩家 ${player.name} 创建子区域 ${name} 失败，区域未完全包含在父区域 ${parentAreaId} 内，且配置不允许超出。`);
            return {
                success: false,
                message: "子区域必须完全在父区域内（根据配置）！"
            };
        }
    } else {
        // 如果配置允许或配置项不存在，则跳过检查
        logDebug(`配置允许子区域 ${name} 超出父区域 ${parentAreaId} 或配置项缺失，跳过包含检查。`);
    }
    // --- 包含检查结束 ---

    // --- 新增：检查是否与禁止区域重叠 ---
    const restrictedZoneCheck = checkOverlapWithRestrictedZones(
        { point1: { ...point1 }, point2: { ...point2 }, dimid: point1.dimid },
        config.restrictedZones || []
    );
    if (restrictedZoneCheck.overlapped) {
        logInfo(`玩家 ${player.name} 创建子区域 ${name} 失败，与禁止区域 "${restrictedZoneCheck.overlappingZone.name || '未命名'}" 重叠。`);
        return {
            success: false,
            message: `无法在此处创建子区域：该区域与禁止区域 "${restrictedZoneCheck.overlappingZone.name || '未命名'}" 重叠！`
        };
    }
    // --- 禁止区域检查结束 ---

    // 检查是否与其他区域重叠 (Optimized)
    const { buildSpatialIndex } = require('./spatialIndex'); // 引入 buildSpatialIndex
    const { checkNewAreaOverlap } = require('./utils'); // 引入优化后的 checkNewAreaOverlap

    // 从 *除了父区域和其所有子区域(兄弟姐妹)* 之外的所有区域构建空间索引
    const areasToCheck = { ...areaData };
    delete areasToCheck[parentAreaId]; // 排除直接父区域

    // 查找并排除所有兄弟姐妹区域
    if (parentArea && parentArea.subareas) {
        for (const siblingId in parentArea.subareas) {
            // 确保 siblingId 存在于 areasToCheck 中再删除
            if (areasToCheck[siblingId]) {
                delete areasToCheck[siblingId];
                logDebug(`创建子区域 ${name} 时，从重叠检查中排除兄弟区域: ${siblingId}`);
            }
        }
    }

    const spatialIndex = buildSpatialIndex(areasToCheck); // 仅对需要检查的区域构建索引

    // 将空间索引和相关的区域数据子集传递给检查函数
    // 注意：需要传递 subArea (新区域), spatialIndex, 和 areasToCheck (用于查找重叠区域详情)
    const overlapCheck = checkNewAreaOverlap(subArea, spatialIndex, areasToCheck);

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
    updateAreaData(areaData);
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
    
    for (let subareaInfo of validSubareas) {
        const area = areaData[subareaInfo.id];
        if (!area) continue; // 以防万一区域数据丢失

        const p1 = area.point1;
        const p2 = area.point2;
        const createDate = new Date(area.createTime).toLocaleString(); // 格式化时间
        // 使用之前导入的 getAreaHierarchyPath
        const hierarchyPath = getAreaHierarchyPath(subareaInfo.id, areaData, 4); // 获取层级路径, 最多显示4层
        const shortId = subareaInfo.id.split('_').pop(); // 获取短ID

        // 构建更详细的按钮文本
        let buttonText = `§l${area.name} §r§7(ID: ${shortId})\n`; // 区域名称和短ID
        buttonText += `§7所有者: ${area.playerName}\n`;
        buttonText += `§7层级: ${hierarchyPath}\n`;
        buttonText += `§7范围: (${p1.x},${p1.y},${p1.z}) - (${p2.x},${p2.y},${p2.z})\n`;
        buttonText += `§7创建于: ${createDate}`;

        fm.addButton(buttonText);
    }

    fm.addButton("§l§c返回上级菜单"); // 返回按钮保持不变
    
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
