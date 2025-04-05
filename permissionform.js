
const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData, updateAreaData } = require('./czareaprotection'); // Added updateAreaData
const { isInArea, isAreaWithinArea, checkNewAreaOverlap, checkAreaSizeLimits } = require('./utils'); // Added utils functions
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { getPlayerCustomGroups, createCustomGroup, editCustomGroup, deleteCustomGroup, getAllCustomGroups } = require('./customGroups'); // Ensure getAllCustomGroups is imported if needed elsewhere, though getAvailableGroups uses it internally
const { checkPermission, setPlayerPermission, getPlayerPermission, getAvailableGroups, getAreaDefaultGroup, setAreaDefaultGroup, resetCache } = require('./permission'); // Removed DEFAULT_GROUPS import, Added resetCache
const { getPlayerData } = require('./playerDataManager');
const { calculateAreaPrice, handleAreaPurchase, handleAreaRefund, getPlayerBalance, reducePlayerBalance, addPlayerBalance } = require('./economy'); // Added economy functions
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/>
const { loadConfig } = require('./configManager');
const { showSubAreaManageForm } = require('./subareaForms');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// 添加 origin 参数
function showPermissionManageForm(player, areaId, origin) {
    const { showAreaOperateForm} = require('./mainForm');
    const areaData = getAreaData();
    const area = areaData[areaId];
    if(!checkPermission(player, areaData, areaId, "setPlayerPermissions")) {
        player.tell("§c你没有权限管理区域成员！");
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }

    const fm = mc.newSimpleForm();
    fm.setTitle(`§e[czland]§l${area.name} - §0权限管理`);
    fm.addButton("添加成员", "textures/ui/Add-Ons_Nav_Icon36x36"); // 更新加号图标
    fm.addButton("查看成员列表", "textures/ui/multiplayer_glyph_color"); // 更新多人图标
    fm.addButton("设置默认权限组", "textures/ui/settings_glyph_color_2x"); // 更新设置图标
    fm.addButton("§c返回", "textures/ui/cancel"); // 路径正确


    player.sendForm(fm, (player, id) => {
        if (id === null) {
             showAreaOperateForm(player, areaId, origin); // 取消返回
             return;
        }

        switch (id) {
            case 0:
                showAddMemberForm(player, areaId, origin); // 传递 origin
                break;
            case 1:
                showMemberListForm(player, areaId, origin); // 传递 origin
                break;
            case 2:
                showAreaDefaultGroupForm(player, areaId, origin); // 传递 origin
                break;
            case 3:
                showAreaOperateForm(player, areaId, origin); // 返回按钮
                break;
        }
    });
}

// 添加 origin 参数
function showAddMemberForm(player, areaId, origin, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];

    // 检查玩家是否有高级管理权限
    const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");

    // 获取所有玩家数据
    const allPlayers = getOfflinePlayerData() || [];

    // 根据搜索关键词过滤玩家
    let filteredPlayers = allPlayers;
    if (filter.trim() !== "") {
        filteredPlayers = allPlayers.filter(p =>
            p.name.toLowerCase().includes(filter.toLowerCase()));
    }

    // 分页设置
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1);

    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
    const pagePlayers = filteredPlayers.slice(startIndex, endIndex);

    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 添加成员`);

    // 搜索框
    fm.addInput("搜索玩家", "输入玩家名称", filter); // index 0

    // 玩家列表
    const playerStartIndex = 1;
    for (let p of pagePlayers) {
        fm.addSwitch(
            `${p.name}`,
            false
        );
    }
    const groupDropdownIndex = playerStartIndex + pagePlayers.length;
    const confirmSwitchIndex = groupDropdownIndex + 1;
    const pageSliderIndex = confirmSwitchIndex + 1;
    const backSwitchIndex = pageSliderIndex + 1; // 新增返回开关索引

    // 权限组选择，获取所有可用组并过滤
    const { getAvailableGroups, groupHasAdminPermissions } = require('./permission'); // Import necessary functions
    const allAvailableGroups = getAvailableGroups(); // 获取所有组 { uniqueKey: groupDetails }

    // 过滤可选的权限组
    // 规则：玩家有 grantAdminPermissions 权限，或者该组不包含管理权限
    const filteredGroupEntries = Object.entries(allAvailableGroups) // [ [uniqueKey, groupDetails], ... ]
        .filter(([uniqueKey, group]) => hasAdminRight || !groupHasAdminPermissions(group)); // 使用更新后的 groupHasAdminPermissions

    // 准备下拉列表的显示文本和对应的 uniqueKey
    const groupOptions = filteredGroupEntries.map(([uniqueKey, group]) => ({
        text: `${group.name} (${group.originalGroupName}) [§b${group.creatorName}§r]`, // 显示名称 (原始组名) [创建者]
        key: uniqueKey // 保存唯一键
    }));

    fm.addDropdown("选择权限组", groupOptions.length > 0 ? groupOptions.map(o => o.text) : ["无可用权限组"]); // index groupDropdownIndex

    // 完成选择开关
    fm.addSwitch("确认添加", false); // index confirmSwitchIndex

    // 分页选择器
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // index pageSliderIndex

    // 返回按钮
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showPermissionManageForm(player, areaId, origin); // 取消返回
            return;
        }

        // 检查返回开关
        if (data[backSwitchIndex]) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        const keyword = data[0].trim();
        const selectedGroupIndex = data[groupDropdownIndex];
        const confirmed = data[confirmSwitchIndex];
        const newPage = data[pageSliderIndex];

        // 处理页面切换
        if (newPage !== currentPage || keyword !== filter) {
            showAddMemberForm(player, areaId, origin, newPage, keyword); // 传递 origin
            return;
        }

        // 处理添加成员
        if (confirmed) {
            if (groupOptions.length === 0) { // 检查 groupOptions
                player.tell("§c没有可用的权限组可以选择！");
                showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
                return;
            }
            // 获取选中的权限组信息
            const selectedOption = groupOptions[selectedGroupIndex];
            if (!selectedOption || !selectedOption.key) {
                 player.tell("§c请选择一个有效的权限组！");
                 showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
                 return;
            }
            const selectedGroupUniqueKey = selectedOption.key;
            const selectedGroupDetails = allAvailableGroups[selectedGroupUniqueKey]; // 从原始数据获取完整详情

            if (!selectedGroupDetails) {
                 player.tell("§c无法找到所选权限组的详细信息！");
                 showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
                 return;
            }
            const groupToSet = selectedGroupDetails.originalGroupName; // 要保存到数据库的是原始组名

            let added = 0;
            let selectedPlayerCount = 0;
            for (let i = 0; i < pagePlayers.length; i++) {
                if (data[i + playerStartIndex]) { // 如果该玩家被选中
                    selectedPlayerCount++;
                    const targetUuid = pagePlayers[i].uuid; // Use Uuid

                    // 再次检查权限，使用获取到的 groupDetails
                    if (!hasAdminRight && groupHasAdminPermissions(selectedGroupDetails)) {
                        player.tell(`§c你没有权限设置管理类权限组 (${selectedGroupDetails.name}) 给玩家 ${pagePlayers[i].name}!`);
                        continue;
                    }

                    // 使用原始组名进行设置
                    if (setPlayerPermission(targetUuid, areaId, groupToSet)) {
                        added++;
                    } else {
                         player.tell(`§c为玩家 ${pagePlayers[i].name} 设置权限组 ${selectedGroupDetails.name} (${groupToSet}) 失败。`);
                    }
                }
            }

            if (added > 0) {
                player.tell(`§a成功为 ${added} 个成员设置权限组: ${selectedGroupDetails.name}`);
            } else if (selectedPlayerCount > 0) {
                 // If players were selected but none were added successfully
                 player.tell(`§c未能成功为任何选定成员设置权限组。`);
            } else {
                 player.tell("§e请至少选择一个玩家。");
                 showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
                 return; // 避免直接返回权限管理界面
            }

            showPermissionManageForm(player, areaId, origin); // 添加成功后返回
            return;
        }

        player.tell("§e请选择玩家，选择权限组，并确认添加。");
        showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
    });
}

// 显示成员列表表单 - 添加 origin 参数
function showMemberListForm(player, areaId, origin) {
    const areaData = getAreaData(); // Keep this
    const area = areaData[areaId]; // Keep this

    // Get player-specific permissions directly from DB
    const { getDbSession } = require('./database');
    const permissions = {}; // { uuid: groupName }
    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT playerUuid, groupName FROM permissions WHERE areaId = ?");
        stmt.bind(areaId);
        while (stmt.step()) {
            const row = stmt.fetch();
            if (row && row.playerUuid && row.groupName) {
                permissions[row.playerUuid] = row.groupName;
            }
        }
        logDebug(`为区域 ${areaId} 的成员列表查询到 ${Object.keys(permissions).length} 条特定权限记录`);
    } catch (e) {
        logError(`在 showMemberListForm 中查询区域 ${areaId} 权限失败: ${e}`, e.stack);
        player.tell("§c查询成员列表时出错！");
        showPermissionManageForm(player, areaId, origin); // 返回上一级
        return;
    }


    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 成员列表`);

    // 获取所有玩家数据用于显示名称
    const allPlayers = getOfflinePlayerData() || [];
    const playerMap = {};
    allPlayers.forEach(p => playerMap[p.uuid] = p.name);

    // 获取所有自定义组用于显示名称和创建者
    const allAvailableGroups = getAvailableGroups(); // { uniqueKey: groupDetails }


    // Store UUIDs in order to map button ID back to UUID
    const memberUuids = [];

    // 显示所有成员 (using the loaded `permissions`)
    for (let uuid in permissions) {
        const groupName = permissions[uuid]; // 这是原始组名
        const playerName = playerMap[uuid] || `未知UUID(${uuid.substring(0,8)}...)`;

        // 尝试找到对应的权限组详细信息（需要遍历 allAvailableGroups）
        let groupDisplayName = groupName; // 默认显示原始组名
        let creatorInfo = "";
        for (const key in allAvailableGroups) {
            const groupDetails = allAvailableGroups[key];
            if (groupDetails.originalGroupName === groupName) {
                // 假设我们只关心第一个匹配到的（如果存在多个同名组）
                // 或者，如果数据库保证了 playerUuid + areaId -> groupName 是唯一的，
                // 并且 groupName + creatorUuid 也是唯一的，那么这里应该能精确匹配
                // 但更安全的方式是，setPlayerPermission 时也保存 creatorUuid
                // 目前，我们先假设能通过原始组名找到一个代表性的组
                groupDisplayName = groupDetails.name;
                creatorInfo = ` [§b${groupDetails.creatorName}§r]`;
                break; // 找到一个就跳出
            }
        }


        fm.addButton(`${playerName}\n§r§7权限组: ${groupDisplayName}${creatorInfo}`, "textures/ui/icon_steve"); // 路径正确
        memberUuids.push(uuid); // Store UUID corresponding to this button
    }

    if (memberUuids.length === 0) {
        fm.setContent("§7该区域尚无特定权限成员。");
    }

    fm.addButton("§c返回", "textures/ui/cancel"); // 路径正确
    const backButtonIndex = memberUuids.length;

    player.sendForm(fm, (player, id) => {
        if (id === null) {
            showPermissionManageForm(player, areaId, origin); // 取消返回
            return;
        }

        // 处理返回按钮
        if (id === backButtonIndex) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        // 点击成员可以修改或移除权限
        if (id >= 0 && id < memberUuids.length) {
            const targetUuid = memberUuids[id]; // Get UUID using the button index
            showMemberEditForm(player, areaId, targetUuid, origin); // Pass UUID and origin
        }
    });
}


// 显示成员编辑表单 - 添加 origin 参数
function showMemberEditForm(player, areaId, targetUuid, origin) {
     const areaData = getAreaData();
     const area = areaData[areaId];
     const currentGroup = getPlayerPermission(targetUuid, areaId); // Get current group from DB

     // 获取所有玩家数据用于显示名称
     const targetPlayerData = getOfflinePlayerData(targetUuid); // Use ll.import directly
     const targetName = targetPlayerData?.name || `未知UUID(${targetUuid.substring(0,8)}...)`;

     const fm = mc.newCustomForm();
     fm.setTitle(`编辑成员权限 - ${targetName}`);

     // 获取所有可用组以显示当前组的完整信息
     const allAvailableGroups = getAvailableGroups(); // { uniqueKey: groupDetails }
     let currentGroupDisplay = '区域默认';
     let currentGroupDetails = null;
     if (currentGroup) {
         // 查找当前组的详细信息
         for (const key in allAvailableGroups) {
             if (allAvailableGroups[key].originalGroupName === currentGroup) {
                 currentGroupDetails = allAvailableGroups[key];
                 currentGroupDisplay = `${currentGroupDetails.name} (${currentGroup}) [§b${currentGroupDetails.creatorName}§r]`;
                 break;
             }
         }
         if (!currentGroupDetails) {
             currentGroupDisplay = `${currentGroup} (未知组)`; // 如果找不到详情
         }
     }
     fm.addLabel(`当前权限组: ${currentGroupDisplay}`); // index 0


     // 权限组选择
     // const playerGroups = getPlayerCustomGroups(player.uuid); // 不再需要只获取玩家的组
     const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");
     const { groupHasAdminPermissions } = require('./permission'); // 引入

     // 过滤规则：玩家有 grantAdminPermissions 权限，或者该组不包含管理权限
     const filteredGroupEntries = Object.entries(allAvailableGroups)
         .filter(([uniqueKey, group]) => hasAdminRight || !groupHasAdminPermissions(group));

     // 准备下拉列表选项
     const groupOptions = filteredGroupEntries.map(([uniqueKey, group]) => ({
         text: `${group.name} (${group.originalGroupName}) [§b${group.creatorName}§r]`,
         key: uniqueKey // 保存唯一键
     }));

     // 添加 "恢复为区域默认权限" 选项
     groupOptions.unshift({ text: "恢复为区域默认权限", key: null }); // key 为 null 代表恢复默认

     // 确定当前组在下拉列表中的索引
     let currentGroupIndex = 0; // 默认指向 "恢复为区域默认权限"
     if (currentGroupDetails) {
         // 查找当前组在过滤后的选项中的位置
         const currentUniqueKey = `${currentGroupDetails.originalGroupName}_${currentGroupDetails.creatorUuid}`;
         const idx = filteredGroupEntries.findIndex(([key, group]) => key === currentUniqueKey);
         if (idx !== -1) {
             currentGroupIndex = idx + 1; // +1 因为 "恢复默认" 在前面
         } else {
             // 如果当前组不在可选列表中 (例如因为权限不足)，添加提示
             fm.addLabel(`§e注意: 当前权限组你无权重新设置，选择其他组将覆盖。`);
             // currentGroupIndex 保持为 0
         }
     }

     // 动态调整索引
     const labelCount = fm.content.length; // 当前控件数量
     const dropdownIndex = labelCount;
     const removeSwitchIndex = dropdownIndex + 1;
     const backSwitchIndex = removeSwitchIndex + 1; // 新增返回开关索引

     fm.addDropdown("选择新权限组", groupOptions.map(o => o.text), currentGroupIndex); // index dropdownIndex
     fm.addSwitch("§c从区域移除此成员特定权限", false); // index removeSwitchIndex
     fm.addSwitch("§c返回成员列表", false); // index backSwitchIndex

     player.sendForm(fm, (player, data) => {
         if (data === null) {
             showMemberListForm(player, areaId, origin); // 取消返回列表
             return;
         }

         // 检查返回开关
         if (data[backSwitchIndex]) {
             showMemberListForm(player, areaId, origin);
             return;
         }

         const selectedIndex = data[dropdownIndex];
         const removeMember = data[removeSwitchIndex];

         if (removeMember) {
             // Remove specific permission setting (reverts to default)
             if (setPlayerPermission(targetUuid, areaId, null)) {
                 player.tell(`§a已移除 ${targetName} 的特定权限设置，将使用区域默认权限。`);
             } else {
                 player.tell(`§c移除 ${targetName} 的特定权限失败。`);
             }
         } else {
             const selectedOption = groupOptions[selectedIndex];
             if (!selectedOption) {
                 player.tell("§c无效的选择。");
                 showMemberListForm(player, areaId, origin); // 返回列表
                 return;
             }

             let groupToSet = null; // 默认为恢复默认
             let selectedGroupDetails = null;

             if (selectedOption.key !== null) { // 如果不是 "恢复默认"
                 selectedGroupDetails = allAvailableGroups[selectedOption.key];
                 if (!selectedGroupDetails) {
                     player.tell("§c无法找到所选权限组的详细信息！");
                     showMemberListForm(player, areaId, origin); // 返回列表
                     return;
                 }
                 groupToSet = selectedGroupDetails.originalGroupName; // 获取原始组名

                 // 再次验证权限
                 if (!hasAdminRight && groupHasAdminPermissions(selectedGroupDetails)) {
                     player.tell(`§c你没有权限将成员设置为管理类权限组 (${selectedGroupDetails.name})!`);
                     showMemberListForm(player, areaId, origin); // 返回列表
                     return;
                 }
             }


             // 设置新权限 (null 如果选择了 "恢复默认")
             if (setPlayerPermission(targetUuid, areaId, groupToSet)) {
                 const groupDisplayName = groupToSet ? (selectedGroupDetails?.name || groupToSet) : '区域默认';
                 player.tell(`§a已将 ${targetName} 的权限设置为: ${groupDisplayName}`);
             } else {
                 player.tell(`§c为 ${targetName} 设置权限失败。`);
             }
         }
         showMemberListForm(player, areaId, origin); // 操作完成后刷新列表
     });
}


// 显示权限组管理主界面 - 添加 origin 参数
function showGroupManageForm(player, areaId, origin) {
    const { showAreaOperateForm} = require('./mainForm');
    const fm = mc.newSimpleForm();
    fm.setTitle("权限组管理");
    fm.addButton("创建新权限组", "textures/ui/pick_block"); // 路径正确
    fm.addButton("管理现有权限组", "textures/ui/permissions_op_crown"); // 更新编辑图标
    // fm.addButton("设置默认权限组"); // 这个功能移到 权限管理 菜单更合适
    fm.addButton("§c返回", "textures/ui/cancel"); // 路径正确

    player.sendForm(fm, (player, id) => {
        if(id === null) {
            showAreaOperateForm(player, areaId, origin); // 取消返回操作菜单
            return;
        }

        switch(id) {
            case 0:
                showCreateGroupForm(player, areaId, origin); // 传递 areaId 和 origin
                break;
            case 1:
                showGroupListForm(player, areaId, origin); // 传递 areaId 和 origin
                break;
            case 2:
                // showDefaultGroupForm(player, areaId); // 这个入口已移除
                showAreaOperateForm(player, areaId, origin); // 返回按钮
                break;
            // case 3: // 原来的返回按钮
            //     showAreaOperateForm(player, areaId, origin);
            //     break;
        }
    });
}

// 添加 areaId 和 origin 参数
function showCreateGroupForm(player, areaId, origin) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');

    const fm = mc.newCustomForm();
    fm.setTitle("创建权限组");
    fm.addInput("权限组ID", "例如: vip"); // index 0
    fm.addInput("显示名称", "例如: VIP会员"); // index 1

    fm.addLabel("§7注意：直接选择所有需要的权限"); // index 2

    // 存储权限和表单索引的映射
    let permissionFormIndexes = new Map();
    let currentIndex = 3; // 从3开始,因为前面有两个输入框和一个标签

    // 按分类添加权限选择
    const categories = getAllCategories();
    categories.forEach(category => {
        fm.addLabel(`§l§6${category}权限`);
        currentIndex++;

        const permsInCategory = getPermissionsByCategory()[category] || [];
        permsInCategory.forEach(perm => {
            fm.addSwitch(`${perm.name}: §7${perm.description}`, false);
            permissionFormIndexes.set(currentIndex, perm.id);
            currentIndex++;
        });
    });

    const backSwitchIndex = currentIndex; // 返回开关索引
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showGroupManageForm(player, areaId, origin); // 取消返回
            return;
        }

        // 检查返回开关
        if (data[backSwitchIndex]) {
            showGroupManageForm(player, areaId, origin);
            return;
        }

        const groupId = data[0].trim();
        const displayName = data[1].trim();

        if(!groupId || !displayName) {
            player.tell("§c权限组ID和显示名称不能为空！");
            showCreateGroupForm(player, areaId, origin); // 重新显示表单
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(groupId)) {
             player.tell("§c权限组ID只能包含字母、数字和下划线！");
             showCreateGroupForm(player, areaId, origin); // 重新显示表单
             return;
        }


        // 收集选中的权限
        const permissions = [];
        permissionFormIndexes.forEach((permId, index) => {
            if(data[index] === true) {
                logDebug(`选中权限: ${permId}`);
                permissions.push(permId);
            }
        });

        logDebug(`创建权限组: ${groupId}, 权限: ${JSON.stringify(permissions)}`);

        // 创建自定义权限组
        if(createCustomGroup(player.uuid, groupId, displayName, permissions, null)) {
            player.tell(`§a权限组创建成功！\n§7包含权限: ${permissions.join(', ')}`);

            // 验证保存结果
            const groups = getPlayerCustomGroups(player.uuid);
            if(groups[groupId]) {
                logDebug(`已保存权限组: ${JSON.stringify(groups[groupId])}`);
            }
            showGroupManageForm(player, areaId, origin); // 创建成功后返回
        } else {
            player.tell("§c权限组创建失败！(可能ID已存在)");
            showCreateGroupForm(player, areaId, origin); // 失败时重新显示创建表单
        }
    });
}

// 设置默认权限组的表单 - 添加 origin 参数
function showAreaDefaultGroupForm(player, areaId, origin) {
    const areaData = getAreaData();
    const area = areaData[areaId];

    // 检查玩家是否是区域所有者或有 setAreaDefaultGroup 权限
    if(!checkPermission(player, areaData, areaId, "setAreaDefaultGroup")) {
        player.tell("§c你没有权限修改默认权限组！");
        showPermissionManageForm(player, areaId, origin); // 返回上一级
        return;
    }

    // 检查玩家是否有高级管理权限 (用于限制设置包含管理权限的组)
    const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");

    const fm = mc.newCustomForm();
    fm.setTitle("设置区域默认权限组");

    // 获取所有自定义权限组
    const { getAvailableGroups, groupHasAdminPermissions } = require('./permission'); // 引入
    const allAvailableGroups = getAvailableGroups(); // { uniqueKey: groupDetails }

    // 过滤可选的权限组
    const filteredGroupEntries = Object.entries(allAvailableGroups)
        .filter(([uniqueKey, group]) => hasAdminRight || !groupHasAdminPermissions(group));

    // 准备下拉列表选项
    const groupOptions = filteredGroupEntries.map(([uniqueKey, group]) => ({
        text: `${group.name} (${group.originalGroupName}) [§b${group.creatorName}§r]`,
        key: uniqueKey // 保存唯一键
    }));

    // 添加 "使用系统默认权限" 选项
    groupOptions.unshift({ text: "使用系统默认权限", key: null }); // key 为 null 代表系统默认

    // 获取当前的默认权限组 (原始组名, null if system default)
    const currentDefaultGroupName = getAreaDefaultGroup(areaId);
    let currentIndex = 0; // 默认指向 "使用系统默认权限"
    let currentDefaultDetails = null;

    if (currentDefaultGroupName) {
        // 查找当前默认组的详细信息（需要遍历）
        for (const key in allAvailableGroups) {
            if (allAvailableGroups[key].originalGroupName === currentDefaultGroupName) {
                currentDefaultDetails = allAvailableGroups[key];
                break;
            }
        }

        if (currentDefaultDetails) {
            // 查找当前默认组在过滤后选项中的位置
            const currentUniqueKey = `${currentDefaultDetails.originalGroupName}_${currentDefaultDetails.creatorUuid}`;
            const idx = filteredGroupEntries.findIndex(([key, group]) => key === currentUniqueKey);
            if (idx !== -1) {
                currentIndex = idx + 1; // +1 因为 "系统默认" 在前面
            } else {
                // 如果当前默认组不在可选列表中
                logWarning(`区域 ${areaId} 的当前默认组 ${currentDefaultGroupName} (创建者: ${currentDefaultDetails.creatorName}) 不在玩家 ${player.name} 的可选列表中。`);
                const currentDefaultDisplay = `${currentDefaultDetails.name} (${currentDefaultGroupName}) [§b${currentDefaultDetails.creatorName}§r]`;
                fm.addLabel(`§e当前默认组: ${currentDefaultDisplay} (你无权选择此组)`);
                // currentIndex 保持为 0
            }
        } else {
            // 数据库中设置了默认组，但在 custom_groups 中找不到？
            logWarning(`区域 ${areaId} 的当前默认组 ${currentDefaultGroupName} 在自定义组列表中未找到！`);
            fm.addLabel(`§e当前默认组: ${currentDefaultGroupName} (未找到详情)`);
            // currentIndex 保持为 0
        }
    }

    fm.addLabel("§e选择一个权限组作为该区域的默认权限组\n§7未设置特定权限组的玩家将使用此权限组");

    // 动态调整索引
    const labelCount = fm.content.length;
    const dropdownIndex = labelCount;
    const backSwitchIndex = dropdownIndex + 1; // 返回开关索引

    fm.addDropdown("选择默认权限组", groupOptions.map(o => o.text), currentIndex); // index dropdownIndex
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showPermissionManageForm(player, areaId, origin); // 取消返回
            return;
        }

        // 检查返回开关
        if (data[backSwitchIndex]) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        const selectedIndex = data[dropdownIndex];
        const selectedOption = groupOptions[selectedIndex];

        if (!selectedOption) {
            player.tell("§c无效的选择！");
            showAreaDefaultGroupForm(player, areaId, origin); // 重新显示
            return;
        }

        let groupToSet = null; // 默认为系统默认
        let selectedGroupDetails = null;

        if (selectedOption.key !== null) { // 如果不是 "系统默认"
            selectedGroupDetails = allAvailableGroups[selectedOption.key];
            if (!selectedGroupDetails) {
                player.tell("§c无法找到所选权限组的详细信息！");
                showAreaDefaultGroupForm(player, areaId, origin); // 重新显示
                return;
            }
            groupToSet = selectedGroupDetails.originalGroupName; // 获取原始组名

            // 再次验证权限
            if (!hasAdminRight && groupHasAdminPermissions(selectedGroupDetails)) {
                player.tell(`§c你没有权限设置包含管理权限的默认权限组 (${selectedGroupDetails.name})!`);
                showPermissionManageForm(player, areaId, origin); // 返回上一级
                return;
            }
            logDebug(`玩家 ${player.name} 选择为区域 ${areaId} 设置默认权限组: ${groupToSet} (显示名: ${selectedGroupDetails.name})`);
        } else {
            logDebug(`玩家 ${player.name} 选择为区域 ${areaId} 设置系统默认权限`);
        }

        // 设置默认权限组 (使用原始组名或 null)
        const success = setAreaDefaultGroup(areaId, groupToSet);

        if(success) {
            const message = groupToSet
                ? `§a已将区域默认权限组设置为: ${selectedGroupDetails?.name || groupToSet}`
                : `§a已设置区域使用系统默认权限`;
            player.tell(message);
        } else {
            player.tell("§c设置默认权限组失败！");
        }


        showPermissionManageForm(player, areaId, origin); // 操作完成后返回
    });
}


//权限组编辑表单 - 添加 areaId 和 origin 参数
function showGroupEditForm(player, groupId, areaId, origin) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');

    const groups = getPlayerCustomGroups(player.uuid);
    const group = groups[groupId];

    if (!group) {
        player.tell(`§c找不到权限组 ${groupId} 或你没有权限编辑它。`);
        showGroupListForm(player, areaId, origin); // 返回列表
        return;
    }

    const fm = mc.newCustomForm();
    fm.setTitle(`编辑权限组 - ${group.name}`);
    fm.addInput("显示名称", "权限组显示名称", group.name); // index 0

    fm.addLabel("§7注意：直接选择所有需要的权限"); // index 1

    // 存储权限和表单索引的映射
    let permissionFormIndexes = new Map();
    let currentIndex = 2; // 从2开始,因为前面有一个输入框和一个标签

    // 按分类添加权限选择
    const categories = getAllCategories();
    categories.forEach(category => {
        fm.addLabel(`§l§6${category}权限`);
        currentIndex++;

        const permsInCategory = getPermissionsByCategory()[category] || [];
        permsInCategory.forEach(perm => {
            const isPermSelected = group.permissions.includes(perm.id);
            fm.addSwitch(`${perm.name}: §7${perm.description}`, isPermSelected);
            permissionFormIndexes.set(currentIndex, perm.id);
            currentIndex++;
        });
    });

    const deleteSwitchIndex = currentIndex;
    const backSwitchIndex = deleteSwitchIndex + 1; // 返回开关索引

    fm.addSwitch("§c删除此权限组", false); // index deleteSwitchIndex
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showGroupListForm(player, areaId, origin); // 取消返回列表
            return;
        }

        // 检查返回开关
        if (data[backSwitchIndex]) {
            showGroupListForm(player, areaId, origin);
            return;
        }

        // 检查是否要删除
        if(data[deleteSwitchIndex]) {
            // 使用 player.sendModalForm 直接发送确认对话框
            player.sendModalForm(
                "确认删除权限组", // title
                `§c确定要删除权限组 "${group.name}" (${groupId}) 吗？\n此操作不可撤销！`, // content
                "§c确认删除", // confirmButton
                "取消", // cancelButton
                (player, confirmed) => { // callback
                    if (confirmed === null) { // 玩家取消表单 (例如按 ESC)
                        showGroupEditForm(player, groupId, areaId, origin); // 返回编辑界面
                        return;
                    }
                    if (confirmed) { // 玩家点击了确认删除
                        if(deleteCustomGroup(player.uuid, groupId)) {
                            player.tell("§a权限组已删除！");
                            resetCache(); // 删除后重置缓存
                            logInfo(`权限组 ${groupId} 已被玩家 ${player.name} 删除，权限缓存已重置`);
                        } else {
                            player.tell("§c删除权限组失败！");
                        }
                        showGroupListForm(player, areaId, origin); // 返回列表
                    } else { // 玩家点击了取消
                        showGroupEditForm(player, groupId, areaId, origin); // 取消删除，返回编辑界面
                    }
                }
            );
            return; // 等待确认结果
        }

        const newName = data[0].trim();
        if(!newName) {
            player.tell("§c显示名称不能为空！");
            showGroupEditForm(player, groupId, areaId, origin); // 重新显示
            return;
        }

        // 收集选中的权限
        const permissions = [];
        permissionFormIndexes.forEach((permId, index) => {
            if(data[index] === true) {
                logDebug(`选中权限: ${permId}`);
                permissions.push(permId);
            }
        });

        logDebug(`编辑权限组: ${groupId}, 新权限: ${JSON.stringify(permissions)}`);

        // 保存修改
        if(editCustomGroup(player.uuid, groupId, newName, permissions, null)) {
            player.tell(`§a权限组修改成功！\n§7包含权限: ${permissions.join(', ')}`);

            // 验证保存结果
            const updatedGroups = getPlayerCustomGroups(player.uuid);
            if(updatedGroups[groupId]) {
                logDebug(`已更新权限组: ${JSON.stringify(updatedGroups[groupId])}`);
            }
            // 清除权限缓存以确保更改立即生效
            resetCache();
            logInfo(`权限组 ${groupId} 修改后，权限缓存已重置`);
            showGroupListForm(player, areaId, origin); // 修改成功后返回列表
        } else {
            player.tell("§c权限组修改失败！");
            showGroupEditForm(player, groupId, areaId, origin); // 失败时重新显示编辑表单
        }
    });
}

// 显示权限组列表 - 添加 areaId 和 origin 参数
function showGroupListForm(player, areaId, origin) {
    const groups = getPlayerCustomGroups(player.uuid);

    const fm = mc.newSimpleForm();
    fm.setTitle("我的权限组");

    const groupIds = Object.keys(groups);

    if (groupIds.length === 0) {
        fm.setContent("§7你还没有创建任何权限组。");
    } else {
        for(let groupId of groupIds) {
            const group = groups[groupId];
            const permCount = group.permissions?.length || 0;
            fm.addButton(`${group.name} (${groupId})\n§7权限数: ${permCount}`, "textures/ui/icon_recipe_item"); // 路径正确
        }
    }

    fm.addButton("§c返回", "textures/ui/cancel"); // 路径正确
    const backButtonIndex = groupIds.length;

    player.sendForm(fm, (player, id) => {
        if(id === null) {
            showGroupManageForm(player, areaId, origin); // 取消返回
            return;
        }

        // 处理返回按钮
        if (id === backButtonIndex) {
            showGroupManageForm(player, areaId, origin);
            return;
        }

        // 点击权限组进行编辑
        if (id >= 0 && id < groupIds.length) {
            const selectedGroupId = groupIds[id];
            showGroupEditForm(player, selectedGroupId, areaId, origin); // 传递 areaId 和 origin
        }
    });
}

// 导出函数
module.exports = {
    showPermissionManageForm,
    showGroupManageForm,
    showAreaDefaultGroupForm,
    showMemberListForm,
    showMemberEditForm,
    showAddMemberForm,
    showGroupListForm,
    showGroupEditForm,
    showCreateGroupForm
};
