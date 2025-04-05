
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

    // 权限组选择，根据权限过滤 - 只显示当前玩家创建的组
    const { getPlayerCustomGroups } = require('./customGroups'); // Import getPlayerCustomGroups
    const groups = getPlayerCustomGroups(player.uuid); // Call getPlayerCustomGroups for the current player
    // const { groupHasAdminPermissions } = require('./permission'); // Already imported at top

    // 过滤权限组 - 现在 groups 只包含当前玩家的组
    const filteredGroupIds = Object.keys(groups)
        // .filter(g => g !== 'owner') // 'owner' shouldn't be a custom group anyway
        .filter(g => hasAdminRight || !groupHasAdminPermissions(g, groups)); // Pass groups data to check

    const groupNames = filteredGroupIds.map(g => `${groups[g].name} (${g})`); // Display name first
    fm.addDropdown("选择权限组", groupNames.length > 0 ? groupNames : ["无可用权限组"]); // index groupDropdownIndex

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
            if (filteredGroupIds.length === 0) {
                player.tell("§c没有可用的权限组可以选择！");
                showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
                return;
            }
            const selectedGroup = filteredGroupIds[selectedGroupIndex];
            if (!selectedGroup) {
                 player.tell("§c请选择一个有效的权限组！");
                 showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
                 return;
            }

            let added = 0;
            let selectedPlayerCount = 0;
            for (let i = 0; i < pagePlayers.length; i++) {
                if (data[i + playerStartIndex]) { // 如果该玩家被选中
                    selectedPlayerCount++;
                    const targetUuid = pagePlayers[i].uuid; // Use Uuid

                    if (!hasAdminRight && groupHasAdminPermissions(selectedGroup, groups)) {
                        player.tell(`§c你没有权限设置管理类权限组 (${selectedGroup}) 给玩家 ${pagePlayers[i].name}!`);
                        continue;
                    }

                    if (setPlayerPermission(targetUuid, areaId, selectedGroup)) {
                        added++;
                    } else {
                         player.tell(`§c为玩家 ${pagePlayers[i].name} 设置权限组 ${selectedGroup} 失败。`);
                    }
                }
            }

            if (added > 0) {
                player.tell(`§a成功为 ${added} 个成员设置权限组: ${groups[selectedGroup].name}`);
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

    // 获取所有自定义组用于显示名称
    const availableGroups = getAvailableGroups();


    // Store UUIDs in order to map button ID back to UUID
    const memberUuids = [];

    // 显示所有成员 (using the loaded `permissions`)
    for (let uuid in permissions) {
        const groupName = permissions[uuid];
        const playerName = playerMap[uuid] || `未知UUID(${uuid.substring(0,8)}...)`;
        const groupDisplayName = availableGroups[groupName]?.name || groupName; // Use display name if available

        fm.addButton(`${playerName}\n§r§7权限组: ${groupDisplayName}`, "textures/ui/icon_steve"); // 路径正确
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
     fm.addLabel(`当前权限组: ${currentGroup ? (getAvailableGroups()[currentGroup]?.name || currentGroup) : '区域默认'}`); // index 0

     // 权限组选择
     const groups = getAvailableGroups(); // 获取所有可用组
     const playerGroups = getPlayerCustomGroups(player.uuid); // 获取当前玩家创建的组
     const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");

     // 过滤规则：
     // 1. 必须是当前玩家创建的组
     // 2. 如果当前玩家没有 grantAdminPermissions 权限，则不能选择包含管理权限的组
     const filteredGroupIds = Object.keys(playerGroups) // Start with player's groups
         .filter(g => hasAdminRight || !groupHasAdminPermissions(g, playerGroups)); // Apply admin check

     const groupNames = filteredGroupIds.map(g => `${playerGroups[g].name} (${g})`);

     // Add option to revert to area default (represented by null)
     groupNames.unshift("恢复为区域默认权限"); // Index 0 in dropdown options

     let currentGroupIndex = 0; // Default to "恢复为区域默认权限"
     if (currentGroup) {
         // 检查当前组是否在 *玩家的可选列表* 中
         const idx = filteredGroupIds.indexOf(currentGroup);
         if (idx !== -1) {
             currentGroupIndex = idx + 1; // +1 because of the added "恢复默认" option
         } else {
             // 如果当前组不是玩家创建或无权设置，显示提示，但下拉菜单仍默认为“恢复默认”
             fm.addLabel(`§e注意: 当前权限组 (${groups[currentGroup]?.name || currentGroup}) 你可能无权重新设置`);
             // currentIndex remains 0
         }
     }

     // 动态调整索引
     const labelCount = fm.content.length; // 当前控件数量
     const dropdownIndex = labelCount;
     const removeSwitchIndex = dropdownIndex + 1;
     const backSwitchIndex = removeSwitchIndex + 1; // 新增返回开关索引

     fm.addDropdown("选择新权限组", groupNames, currentGroupIndex); // index dropdownIndex
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
             let newGroupName = null;
             if (selectedIndex > 0) { // If a specific group was chosen (not "恢复默认")
                 newGroupName = filteredGroupIds[selectedIndex - 1];

                 // Re-validate admin permission grant using player's groups
                 if (!hasAdminRight && groupHasAdminPermissions(newGroupName, playerGroups)) {
                     player.tell(`§c你没有权限将成员设置为管理类权限组 (${newGroupName})!`);
                     showMemberListForm(player, areaId, origin); // 返回列表
                     return;
                 }
             }

             // Set new permission (null if "恢复默认" was chosen)
             if (setPlayerPermission(targetUuid, areaId, newGroupName)) {
                 const groupDisplayName = newGroupName ? (playerGroups[newGroupName]?.name || newGroupName) : '区域默认';
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

    // 获取所有自定义权限组 (用于显示名称) 和 当前玩家创建的组 (用于过滤可选列表)
    const availableGroups = getAvailableGroups(); // All groups for display names
    const playerGroups = getPlayerCustomGroups(player.uuid); // Player's groups for selection
    // const { groupHasAdminPermissions } = require('./permission'); // Already imported

    // 过滤可选的权限组 - 基于玩家自己的组
    const filteredGroupIds = Object.keys(playerGroups)
        .filter(g => hasAdminRight || !groupHasAdminPermissions(g, playerGroups)); // Pass playerGroups data

    const groupNames = filteredGroupIds.map(g => `${playerGroups[g].name} (${g})`); // 使用 playerGroups 获取名称

    // 添加一个"使用系统默认权限"选项
    groupNames.unshift("使用系统默认权限"); // Index 0

    // 获取当前的默认权限组 (null if system default)
    const currentDefault = getAreaDefaultGroup(areaId);
    let currentIndex = 0; // Default to "使用系统默认权限"
    let conditionalLabelAdded = false; // Flag to track if the warning label is added

    if (currentDefault) { // If a custom group is set as default
        const idx = filteredGroupIds.indexOf(currentDefault);
        if (idx !== -1) { // Check if the current default is in the filtered list
            currentIndex = idx + 1; // +1 because "使用系统默认权限" is at index 0
        } else {
             logWarning(`区域 ${areaId} 的当前默认组 ${currentDefault} 不在玩家 ${player.name} 的可选列表中。`);
             // Optionally add a label indicating the current (unselectable) group
             const currentDefaultName = availableGroups[currentDefault]?.name || currentDefault;
             fm.addLabel(`§e当前默认组: ${currentDefaultName} (你无权选择此组)`);
             conditionalLabelAdded = true; // Set the flag
        }
    }

    fm.addLabel("§e选择一个权限组作为该区域的默认权限组\n§7未设置特定权限组的玩家将使用此权限组");

    // 动态调整索引
    const labelCount = fm.content.length;
    const dropdownIndex = labelCount;
    const backSwitchIndex = dropdownIndex + 1; // 返回开关索引

    fm.addDropdown("选择默认权限组", groupNames.length > 0 ? groupNames : ["使用系统默认权限"], currentIndex); // index dropdownIndex
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


        let selectedGroupName = null;
        if (selectedIndex === 0) {
            // 选择使用系统默认权限 (represented by null in DB)
            selectedGroupName = null; // Explicitly set to null for setAreaDefaultGroup
             logDebug(`玩家 ${player.name} 选择为区域 ${areaId} 设置系统默认权限`);
        } else {
            // 选择使用自定义权限组
            if (filteredGroupIds.length === 0 || selectedIndex > filteredGroupIds.length) {
                 player.tell("§c无效的选择！");
                 showAreaDefaultGroupForm(player, areaId, origin); // 重新显示
                 return;
            }
            selectedGroupName = filteredGroupIds[selectedIndex - 1]; // -1 because of the "系统默认" option
            logDebug(`玩家 ${player.name} 选择为区域 ${areaId} 设置默认权限组: ${selectedGroupName}`);

            // 再次验证权限以防止客户端篡改
            // 使用玩家自己的组数据进行验证
            if (!hasAdminRight && groupHasAdminPermissions(selectedGroupName, playerGroups)) { // 使用 playerGroups
                player.tell(`§c你没有权限设置包含管理权限的默认权限组 (${selectedGroupName})!`);
                showPermissionManageForm(player, areaId, origin); // 返回上一级
                return;
            }
        }
        const success = setAreaDefaultGroup(areaId, selectedGroupName);

        if(success) {
            const message = selectedGroupName
                ? `§a已将区域默认权限组设置为: ${playerGroups[selectedGroupName]?.name || selectedGroupName}` // 使用 playerGroups 获取名称
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
            // 添加删除确认
            const confirmFm = mc.newModalForm();
            confirmFm.setTitle("确认删除权限组");
            confirmFm.setContent(`§c确定要删除权限组 "${group.name}" (${groupId}) 吗？\n此操作不可撤销！`);
            confirmFm.setButton1("§c确认删除");
            confirmFm.setButton2("取消");
            player.sendForm(confirmFm, (player, confirmed) => {
                if (confirmed) {
                    if(deleteCustomGroup(player.uuid, groupId)) {
                        player.tell("§a权限组已删除！");
                        resetCache(); // 删除后重置缓存
                        logInfo(`权限组 ${groupId} 已被玩家 ${player.name} 删除，权限缓存已重置`);
                    } else {
                        player.tell("§c删除权限组失败！");
                    }
                    showGroupListForm(player, areaId, origin); // 返回列表
                } else {
                    showGroupEditForm(player, groupId, areaId, origin); // 取消删除，返回编辑界面
                }
            });
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
