const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData, updateAreaData } = require('./czareaprotection'); // Added updateAreaData
const { isInArea, isAreaWithinArea, checkNewAreaOverlap, checkAreaSizeLimits } = require('./utils'); // Added utils functions
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { getPlayerCustomGroups, createCustomGroup, editCustomGroup, deleteCustomGroup } = require('./customGroups'); // Removed getAllCustomGroups as getAvailableGroups is used
const { checkPermission, setPlayerPermission, getPlayerPermission, getAvailableGroups, getAreaDefaultGroup, setAreaDefaultGroup, resetCache, getSystemDefaultPermissions, groupHasAdminPermissions } = require('./permission'); // Added getSystemDefaultPermissions, groupHasAdminPermissions
const { getPlayerData } = require('./playerDataManager');
const { calculateAreaPrice, handleAreaPurchase, handleAreaRefund, getPlayerBalance, reducePlayerBalance, addPlayerBalance } = require('./economy'); // Added economy functions
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/>
const { loadConfig } = require('./configManager');
const { showSubAreaManageForm } = require('./subareaForms');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
const { getDbSession } = require('./database'); // Added database import

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
    fm.addButton("添加成员", "textures/ui/Add-Ons_Nav_Icon36x36"); // 0
    fm.addButton("查看/编辑特定成员", "textures/ui/multiplayer_glyph_color"); // 1 - 重命名，功能不变
    fm.addButton("管理所有玩家权限", "textures/ui/icon_setting"); // 2 - 新增按钮
    fm.addButton("设置默认权限组", "textures/ui/settings_glyph_color_2x"); // 3
    fm.addButton("§c返回", "textures/ui/cancel"); // 4


    player.sendForm(fm, (player, id) => {
        if (id === null) {
             showAreaOperateForm(player, areaId, origin); // 取消返回
             return;
        }

        switch (id) {
            case 0:
                showAddMemberForm(player, areaId, origin);
                break;
            case 1: // 查看/编辑特定成员
                showMemberListForm(player, areaId, origin); // 跳转到只显示特定权限成员的列表
                break;
            case 2: // 管理所有玩家权限
                showAllPlayersPermissionForm(player, areaId, origin); // 跳转到新表单
                break;
            case 3: // 设置默认权限组
                showAreaDefaultGroupForm(player, areaId, origin);
                break;
            case 4: // 返回
                showAreaOperateForm(player, areaId, origin);
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
    const allAvailableGroups = getAvailableGroups(); // 获取所有组 { uniqueKey: groupDetails }
    logDebug(`[showAddMemberForm] getAvailableGroups 返回 ${Object.keys(allAvailableGroups).length} 个组`); // <-- 添加日志

    // --- 修改开始 ---
    // 过滤可选的权限组
    // 规则 1: 必须是当前玩家或区域主人创建的组
    // 规则 2: 玩家有 grantAdminPermissions 权限，或者该组不包含管理权限
    const filteredGroupEntries = Object.entries(allAvailableGroups) // [ [uniqueKey, groupDetails], ... ]
        .filter(([uniqueKey, group]) => {
            const isCreatorSelf = group.creatorUuid === player.uuid;
            // 注意：area.xuid 是 XUID，而 group.creatorUuid 是 UUID。需要转换或确认 area 对象是否有 ownerUuid
            // 假设 area 对象上有 ownerUuid 属性，如果没有，需要从其他地方获取。
            const areaOwnerUuid = area.ownerUuid || null; // 假设 area 对象有 ownerUuid
            const isCreatorOwner = areaOwnerUuid && group.creatorUuid === areaOwnerUuid;

            const isOwnOrOwnerGroup = isCreatorSelf || isCreatorOwner;

            const canSelectGroup = hasAdminRight || !groupHasAdminPermissions(group);

            return isOwnOrOwnerGroup && canSelectGroup;
        });
    // <-- 添加日志 v
    logDebug(`[showAddMemberForm] 过滤后剩下 ${filteredGroupEntries.length} 个组可供选择: ${JSON.stringify(filteredGroupEntries.map(([key, grp]) => ({ key: key, name: grp.name, creator: grp.creatorName })))}`);
    // --- 修改结束 ---


    // 准备下拉列表的显示文本和对应的 uniqueKey
    const groupOptions = filteredGroupEntries.map(([uniqueKey, group]) => ({
        text: `${group.name} (${group.originalGroupName}) [§b${group.creatorName}§r]`, // 显示名称 (原始组名) [创建者]
        key: uniqueKey // 保存唯一键
    }));
    // <-- 添加日志 v
    logDebug(`[showAddMemberForm] 生成的下拉菜单选项 (groupOptions): ${JSON.stringify(groupOptions)}`);

    fm.addDropdown("选择权限组", groupOptions.length > 0 ? groupOptions.map(o => o.text) : ["无可用权限组"], 0); // index groupDropdownIndex, 默认选第一个

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
                resetCache(); // 清理缓存
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

        // 如果没有确认，但有操作（如翻页或搜索），则不提示此消息
        if (newPage === currentPage && keyword === filter && !confirmed) {
            player.tell("§e请选择玩家，选择权限组，并确认添加。");
            showAddMemberForm(player, areaId, origin, currentPage, filter); // 重新显示表单
        }
    });
}

// 显示成员列表表单 (只显示有特定权限的) - 改为 CustomForm 样式 - 添加 origin 参数
function showMemberListForm(player, areaId, origin, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];

    // 1. 获取特定权限玩家
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

    const memberUuidsWithPerms = Object.keys(permissions);

    // 2. 获取所有玩家数据用于名称查找
    const allPlayersData = getOfflinePlayerData() || [];
    const playerMap = {};
    allPlayersData.forEach(p => playerMap[p.uuid] = p.name);

    // 3. 获取所有自定义组用于显示名称和创建者
    const allAvailableGroups = getAvailableGroups(); // { uniqueKey: groupDetails }

    // 4. 过滤玩家
    let filteredMemberUuids = memberUuidsWithPerms;
    if (filter.trim() !== "") {
        const lowerCaseFilter = filter.toLowerCase();
        filteredMemberUuids = memberUuidsWithPerms.filter(uuid => {
            const name = playerMap[uuid] || '';
            return name.toLowerCase().includes(lowerCaseFilter);
        });
    }

    // 5. 分页设置
    const pageSize = 5;
    const totalMembers = filteredMemberUuids.length;
    const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1); // 确保页码有效

    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalMembers);
    const pageMemberUuids = filteredMemberUuids.slice(startIndex, endIndex);

    // 6. 创建 CustomForm
    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 查看/编辑成员`); // 更新标题

    // 7. 添加搜索框
    fm.addInput("搜索成员", "输入玩家名称", filter); // index 0

    // 8. 添加玩家列表 (使用 Switch 模拟按钮)
    const playerStartIndex = 1; // 开关从索引 1 开始
    if (pageMemberUuids.length === 0) {
        fm.addLabel("§7没有找到符合条件的成员。");
    } else {
        for (const uuid of pageMemberUuids) {
            const groupName = permissions[uuid]; // 这是原始组名
            const playerName = playerMap[uuid] || `未知UUID(${uuid.substring(0, 8)}...)`;

            // 查找权限组显示名称和创建者
            let groupDisplayName = groupName;
            let creatorInfo = "";
            for (const key in allAvailableGroups) {
                const groupDetails = allAvailableGroups[key];
                if (groupDetails.originalGroupName === groupName && groupDetails.creatorUuid) {
                    const targetKey = `${groupName}_${groupDetails.creatorUuid}`;
                    const foundGroup = allAvailableGroups[targetKey];
                    if (foundGroup) {
                        groupDisplayName = foundGroup.name;
                        creatorInfo = ` [§b${foundGroup.creatorName}§r]`;
                        break;
                    }
                } else if (groupDetails.originalGroupName === groupName) {
                    groupDisplayName = groupDetails.name;
                    creatorInfo = ` [§b${groupDetails.creatorName}§r]`;
                }
            }
            if (!creatorInfo && groupName) { // 如果没找到创建者但有组名
                 creatorInfo = " [§c未知§r]";
            }

            fm.addSwitch(`${playerName}\n§r§7权限组: ${groupDisplayName}${creatorInfo}`, false); // 使用 Switch
        }
    }

    // --- Correct Index Calculation ---
    // Calculate the index *after* adding player elements
    // --- Correct Index Calculation ---
    // Calculate the index *after* adding player elements
    const lastPlayerElementIndex = (pageMemberUuids.length > 0) ? playerStartIndex + pageMemberUuids.length - 1 : playerStartIndex; // Index of the last switch or the label if no players
    const confirmEditSwitchIndex = lastPlayerElementIndex + 1; // 新增确认编辑开关索引
    const pageSliderIndex = confirmEditSwitchIndex + 1;
    const backSwitchIndex = pageSliderIndex + 1;
    // --- End Correct Index Calculation ---

    // 8.5 添加确认编辑按钮 (在玩家列表之后，分页器之前)
    if (pageMemberUuids.length > 0) { // 只在有成员时显示确认按钮
        fm.addSwitch("§a确认编辑选定成员", false); // Uses confirmEditSwitchIndex
    } else {
        // 如果没有成员，添加一个占位符或者不添加，以保持索引计算一致性
        // 这里选择不添加，但需要在回调中处理 confirmEditSwitchIndex 可能不存在的情况
        // 或者添加一个 Label 占位
         fm.addLabel(""); // 添加一个空 Label 占位，确保后续索引正确
    }


    // 9. 添加分页器
    const pageItems = Array.from({ length: totalPages }, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // Uses pageSliderIndex

    // 10. 添加返回按钮
    fm.addSwitch("§c返回", false); // Uses backSwitchIndex

    // 11. 发送表单并处理回调
    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        // --- Added Check for Undefined ---
        if (data === undefined) {
            logError(`[showMemberListForm Callback] Received undefined data for area ${areaId}`);
            player.tell("§c处理表单时发生内部错误 (Data Undefined)，请重试。");
            showPermissionManageForm(player, areaId, origin);
            return;
        }
        // --- End Added Check ---

        // --- More Robust Data Validation ---
        if (!Array.isArray(data)) {
            logError(`[showMemberListForm Callback] Received non-array data: ${JSON.stringify(data)}`);
            player.tell("§c处理表单时发生内部错误 (Data Type)，请重试。");
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        // Check if essential indices exist before using them for further checks/logic
        if (data.length <= 0) { // Check for search input index
            logError(`[showMemberListForm Callback] Received data array too short for search input (length ${data.length})`);
            player.tell("§c处理表单时发生错误 (Data Short 1)，请重试。");
            showPermissionManageForm(player, areaId, origin);
            return;
        }
        const keyword = data[0].trim(); // Safe now

        // Recalculate expected indices *inside* the callback for safety,
        // using the same logic as when building the form.
        const currentExpectedLastPlayerIndex = (pageMemberUuids.length > 0) ? playerStartIndex + pageMemberUuids.length - 1 : playerStartIndex;
        const currentExpectedConfirmIndex = lastPlayerElementIndex + 1; // 确认按钮索引
        const currentExpectedSliderIndex = currentExpectedConfirmIndex + 1;
        const currentExpectedBackIndex = currentExpectedSliderIndex + 1;
        const minimumExpectedLength = currentExpectedBackIndex + 1; // Need index up to currentExpectedBackIndex

        // 检查数据长度是否足够包含所有预期控件
        if (data.length < minimumExpectedLength) {
            logError(`[showMemberListForm Callback] Received data array shorter than expected (length ${data.length}, expected at least ${minimumExpectedLength} based on ${pageMemberUuids.length} players on page)`);
            player.tell("§c处理表单时发生错误 (Data Short 2)，请重试。");
            showPermissionManageForm(player, areaId, origin);
            return;
        }
        // --- End Robust Data Validation ---


        // Now access using expected indices, which are confirmed to be within bounds
        const confirmEditPressed = (pageMemberUuids.length > 0) ? data[currentExpectedConfirmIndex] : false; // 如果没成员，确认按钮不存在，视为 false
        const newPage = data[currentExpectedSliderIndex];
        const backButtonPressed = data[currentExpectedBackIndex];

        if (backButtonPressed === true) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }


        // 处理页面切换或搜索
        if (newPage !== currentPage || keyword !== filter) {
            showMemberListForm(player, areaId, origin, newPage, keyword);
            return; // 优先处理返回
        }

        // 处理页面切换或搜索 (如果确认按钮没按)
        if (!confirmEditPressed && (newPage !== currentPage || keyword !== filter)) {
            showMemberListForm(player, areaId, origin, newPage, keyword);
            return;
        }

        // 处理确认编辑操作
        if (confirmEditPressed) {
            let selectedPlayerUuid = null;
            let selectedCount = 0;
            if (pageMemberUuids.length > 0) {
                for (let i = 0; i < pageMemberUuids.length; i++) {
                    const switchIndex = playerStartIndex + i;
                    if (data[switchIndex] === true) {
                        selectedPlayerUuid = pageMemberUuids[i];
                        selectedCount++;
                    }
                }
            }

            if (selectedCount === 1) {
                // 如果确认编辑且只选择了一个玩家，跳转到编辑表单
                showMemberEditForm(player, areaId, selectedPlayerUuid, origin);
            } else if (selectedCount === 0) {
                player.tell("§c请先选择一个成员，再点击确认编辑。");
                showMemberListForm(player, areaId, origin, currentPage, filter); // 重新显示当前页
            } else { // selectedCount > 1
                player.tell("§c一次只能编辑一个成员，请取消多余的选择。");
                showMemberListForm(player, areaId, origin, currentPage, filter); // 重新显示当前页
            }
        } else {
             // 如果没有按确认，也不是翻页/搜索，则重新显示表单 (可能用户只是误触了某个开关)
             // player.tell("§e请选择成员并点击确认编辑，或进行翻页/搜索。"); // 可以选择不提示
             showMemberListForm(player, areaId, origin, currentPage, filter);
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
             const group = allAvailableGroups[key];
             // 精确匹配原始组名和创建者UUID
             if (group.originalGroupName === currentGroup && group.creatorUuid) {
                  const targetKey = `${currentGroup}_${group.creatorUuid}`;
                  const foundGroup = allAvailableGroups[targetKey];
                  if(foundGroup){
                       currentGroupDetails = foundGroup;
                       currentGroupDisplay = `${foundGroup.name} (${currentGroup}) [§b${foundGroup.creatorName}§r]`;
                       break;
                  }
             }
             // Fallback 匹配
             else if (group.originalGroupName === currentGroup) {
                  currentGroupDetails = group; // 可能不精确
                  currentGroupDisplay = `${group.name} (${currentGroup}) [§b${group.creatorName}§r]`;
                  // Don't break, keep searching for a better match
             }
         }
         if (!currentGroupDetails) {
             currentGroupDisplay = `${currentGroup} (未知或系统组)`; // 如果找不到详情
         }
     }
     fm.addLabel(`当前权限组: ${currentGroupDisplay}`); // index 0


     // 权限组选择
     const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");

     // 过滤规则：玩家有 grantAdminPermissions 权限，或者该组不包含管理权限
     // + 必须是自己或区域主人创建的组 (与 addMember 保持一致)
     const areaOwnerUuid = area.ownerUuid || null;
     const filteredGroupEntries = Object.entries(allAvailableGroups)
         .filter(([uniqueKey, group]) => {
             const isCreatorSelf = group.creatorUuid === player.uuid;
             const isCreatorOwner = areaOwnerUuid && group.creatorUuid === areaOwnerUuid;
             const isOwnOrOwnerGroup = isCreatorSelf || isCreatorOwner;
             const canSelectGroup = hasAdminRight || !groupHasAdminPermissions(group);
             return isOwnOrOwnerGroup && canSelectGroup;
         });

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
         // Find index in filteredGroupEntries, not groupOptions directly yet
         const idx = filteredGroupEntries.findIndex(([key, group]) => key === currentUniqueKey);
         if (idx !== -1) {
             currentGroupIndex = idx + 1; // +1 因为 "恢复默认" 在前面
         } else {
             // 如果当前组不在可选列表中 (例如因为权限不足或非自己/主人创建)，添加提示
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
                 resetCache(); // 清理缓存
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

                 // 再次验证权限 (理论上过滤已完成，保留更安全)
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
                 resetCache(); // 清理缓存
             } else {
                 player.tell(`§c为 ${targetName} 设置权限失败。`);
             }
         }
         showMemberListForm(player, areaId, origin); // 操作完成后刷新列表
     });
}

// --- 修改后函数：管理特定权限玩家 ---
function showAllPlayersPermissionForm(player, areaId, origin, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];
    const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");

    // 1. 获取拥有特定权限的玩家 UUID 和组名
    const specificPermissions = {}; // { uuid: groupName }
    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT playerUuid, groupName FROM permissions WHERE areaId = ?");
        stmt.bind(areaId);
        while (stmt.step()) {
            const row = stmt.fetch();
            if (row && row.playerUuid && row.groupName) {
                specificPermissions[row.playerUuid] = row.groupName;
            }
        }
        logDebug(`为区域 ${areaId} 的特定权限玩家列表查询到 ${Object.keys(specificPermissions).length} 条记录`);
    } catch (e) {
        logError(`在 showAllPlayersPermissionForm 中查询区域 ${areaId} 特定权限失败: ${e}`, e.stack);
        player.tell("§c查询特定权限成员列表时出错！");
        showPermissionManageForm(player, areaId, origin); // 返回上一级
        return;
    }

    const playersWithSpecificPerms = Object.entries(specificPermissions).map(([uuid, groupName]) => ({ uuid, groupName })); // [{uuid, groupName}, ...]

    // 2. 获取所有玩家数据用于名称查找
    const allPlayersData = getOfflinePlayerData() || [];
    const playerMap = {}; // { uuid: name }
    allPlayersData.forEach(p => playerMap[p.uuid] = p.name);

    // 3. 根据搜索关键词过滤玩家
    let filteredPlayers = playersWithSpecificPerms;
    if (filter.trim() !== "") {
        const lowerCaseFilter = filter.toLowerCase();
        filteredPlayers = playersWithSpecificPerms.filter(p => {
            const name = playerMap[p.uuid] || '';
            return name.toLowerCase().includes(lowerCaseFilter);
        });
    }

    // 4. 分页设置
    const pageSize = 5; // 每页显示5个玩家
    const totalMembers = filteredPlayers.length;
    const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1); // 确保页码有效

    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalMembers);
    const pagePlayers = filteredPlayers.slice(startIndex, endIndex); // pagePlayers is now [{uuid, groupName}, ...]

    // 5. 创建 CustomForm
    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 特定权限成员管理`); // 更新标题

    // 6. 添加搜索框
    fm.addInput("搜索特定权限成员", "输入玩家名称", filter); // index 0

    // 7. 获取所有可用权限组用于显示名称
    const allAvailableGroups = getAvailableGroups();

    // 8. 添加玩家列表和权限显示
    const playerStartIndex = 1; // 开关从索引 1 开始
    const playerUuidsOnPage = []; // 存储当前页玩家的 UUID
    if (pagePlayers.length === 0) {
        fm.addLabel("§7没有找到符合条件的特定权限成员。");
    } else {
        for (const pData of pagePlayers) { // pData is {uuid, groupName}
            playerUuidsOnPage.push(pData.uuid);
            const playerName = playerMap[pData.uuid] || `未知UUID(${pData.uuid.substring(0, 8)}...)`;
            const specificGroup = pData.groupName; // 直接使用从数据库获取的组名
            let groupDisplayName = specificGroup; // 默认显示原始组名
            let creatorInfo = "";

            // 查找特定组的显示名称和创建者
            for (const key in allAvailableGroups) {
                const groupDetails = allAvailableGroups[key];
                // 精确匹配
                if (groupDetails.originalGroupName === specificGroup && groupDetails.creatorUuid) {
                    const targetKey = `${specificGroup}_${groupDetails.creatorUuid}`;
                    const foundGroup = allAvailableGroups[targetKey];
                    if (foundGroup) {
                        groupDisplayName = foundGroup.name;
                        creatorInfo = ` [§b${foundGroup.creatorName}§r]`;
                        break;
                    }
                }
                // Fallback 匹配
                else if (groupDetails.originalGroupName === specificGroup) {
                    groupDisplayName = groupDetails.name;
                    creatorInfo = ` [§b${groupDetails.creatorName}§r]`;
                    // Don't break, keep searching for a better match
                }
            }
             if (!creatorInfo && specificGroup) { // 如果没找到创建者但有组名
                 creatorInfo = " [§c未知§r]";
             }

            fm.addSwitch(`${playerName}\n§r§7权限组: ${groupDisplayName}${creatorInfo}`, false); // 显示玩家名和其特定的权限组
        }
    }


    // 9. 批量操作控件 (索引计算需要基于实际添加的元素)
    const lastPlayerElementIndex = (pagePlayers.length > 0) ? playerStartIndex + pagePlayers.length - 1 : playerStartIndex; // Index of the last switch or the label if no players
    const batchActionStartIndex = playerStartIndex + pagePlayers.length;
    fm.addLabel("--- §6批量操作 (对上方选中的玩家生效) ---"); // index batchActionStartIndex

    // 批量重置权限组下拉菜单 (只显示当前玩家自己的组)
    const myGroupEntries = Object.entries(allAvailableGroups)
        .filter(([key, group]) => group.creatorUuid === player.uuid && (hasAdminRight || !groupHasAdminPermissions(group))); // 过滤：自己的 + 权限允许

    const myGroupOptions = myGroupEntries.map(([key, group]) => ({
        text: `${group.name} (${group.originalGroupName})`,
        key: key // uniqueKey
    }));

    const resetGroupDropdownIndex = batchActionStartIndex + 1;
    fm.addDropdown("批量重置为我的权限组:", myGroupOptions.length > 0 ? myGroupOptions.map(o => o.text) : ["你没有可用的权限组"], 0); // index resetGroupDropdownIndex

    const resetConfirmSwitchIndex = resetGroupDropdownIndex + 1;
    fm.addSwitch("§e确认批量重置权限", false); // index resetConfirmSwitchIndex

    const deleteConfirmSwitchIndex = resetConfirmSwitchIndex + 1;
    fm.addSwitch("§c确认批量移除特定权限 (恢复默认)", false); // index deleteConfirmSwitchIndex

    // 分页和返回
    const pageSliderIndex = deleteConfirmSwitchIndex + 1;
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // index pageSliderIndex

    const backSwitchIndex = pageSliderIndex + 1;
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
        const newPage = data[pageSliderIndex];

        // 处理页面切换或搜索
        if (newPage !== currentPage || keyword !== filter) {
            showAllPlayersPermissionForm(player, areaId, origin, newPage, keyword);
            return;
        }

        // 处理批量操作
        const selectedPlayerIndices = [];
        for (let i = 0; i < pagePlayers.length; i++) {
            if (data[playerStartIndex + i]) { // 检查开关是否被选中
                selectedPlayerIndices.push(i);
            }
        }

        const resetConfirmed = data[resetConfirmSwitchIndex];
        const deleteConfirmed = data[deleteConfirmSwitchIndex];

        if (selectedPlayerIndices.length === 0 && (resetConfirmed || deleteConfirmed)) {
            player.tell("§c请至少选择一个玩家进行批量操作！");
            showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter);
            return;
        }

        let operationPerformed = false;
        let successCount = 0;
        let failCount = 0;

        // 优先处理删除操作
        if (deleteConfirmed) {
            operationPerformed = true;
            player.tell(`§6开始批量移除 ${selectedPlayerIndices.length} 个玩家的特定权限...`);
            for (const index of selectedPlayerIndices) {
                const targetUuid = playerUuidsOnPage[index];
                if (setPlayerPermission(targetUuid, areaId, null)) {
                    successCount++;
                } else {
                    failCount++;
                    logWarning(`批量移除玩家 ${targetUuid} 特定权限失败`);
                }
            }
            if (successCount > 0) player.tell(`§a成功移除 ${successCount} 个玩家的特定权限。`);
            if (failCount > 0) player.tell(`§c有 ${failCount} 个玩家的特定权限移除失败。`);
            resetCache(); // 清理缓存
        }
        // 处理重置操作 (如果删除未执行或失败)
        else if (resetConfirmed) {
            operationPerformed = true;
            if (myGroupOptions.length === 0) {
                player.tell("§c你没有可用的权限组来执行批量重置！");
                showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter);
                return;
            }
            const selectedMyGroupIndex = data[resetGroupDropdownIndex];
            const selectedMyGroupOption = myGroupOptions[selectedMyGroupIndex];
            if (!selectedMyGroupOption || !selectedMyGroupOption.key) {
                player.tell("§c请选择一个有效的权限组进行重置！");
                showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter);
                return;
            }

            const groupToSetDetails = allAvailableGroups[selectedMyGroupOption.key];
            if (!groupToSetDetails) {
                 player.tell("§c无法找到所选权限组的详细信息！");
                 showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter);
                 return;
            }
            const groupToSet = groupToSetDetails.originalGroupName; // 获取原始组名

            player.tell(`§6开始批量重置 ${selectedPlayerIndices.length} 个玩家的权限为: ${groupToSetDetails.name}...`);
            for (const index of selectedPlayerIndices) {
                const targetUuid = playerUuidsOnPage[index];
                if (setPlayerPermission(targetUuid, areaId, groupToSet)) {
                    successCount++;
                } else {
                    failCount++;
                    logWarning(`批量重置玩家 ${targetUuid} 权限为 ${groupToSet} 失败`);
                }
            }
            if (successCount > 0) player.tell(`§a成功重置 ${successCount} 个玩家的权限。`);
            if (failCount > 0) player.tell(`§c有 ${failCount} 个玩家的权限重置失败。`);
            resetCache(); // 清理缓存
        }

        // 如果执行了操作，刷新表单；否则提示
        if (operationPerformed) {
            showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter); // 刷新当前页
        } else if (!operationPerformed && (resetConfirmed || deleteConfirmed)) {
             // This case should not happen if selection check is done right, but as a fallback
             player.tell("§e请选择玩家并确认一项批量操作。");
             showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter);
        } else if (!operationPerformed && !resetConfirmed && !deleteConfirmed) {
             // No operation selected, just redisplay
             // player.tell("§e请选择一项批量操作并确认。"); // Maybe too noisy
             showAllPlayersPermissionForm(player, areaId, origin, currentPage, filter);
        }
    });
}


// 显示权限组管理主界面 - 添加 origin 参数
function showGroupManageForm(player, areaId, origin) {
    const { showAreaOperateForm} = require('./mainForm');
    const fm = mc.newSimpleForm();
    fm.setTitle("权限组管理");
    fm.addButton("创建新权限组", "textures/ui/pick_block"); // 0
    fm.addButton("管理现有权限组", "textures/ui/permissions_op_crown"); // 1
    fm.addButton("查看权限组应用情况", "textures/ui/icon_map"); // 2 - 新增按钮
    fm.addButton("§c返回", "textures/ui/cancel"); // 3

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
                showGroupUsageForm(player, areaId, origin); // 跳转到新表单
                break;
            case 3:
                showAreaOperateForm(player, areaId, origin); // 返回按钮
                break;
        }
    });
}

// 添加 areaId 和 origin 参数
function showCreateGroupForm(player, areaId, origin) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');

    const fm = mc.newCustomForm();
    fm.setTitle("创建权限组");
    fm.addInput("权限组ID", "例如: vip (字母数字下划线)"); // index 0
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
            resetCache(); // 清理缓存
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
    const allAvailableGroups = getAvailableGroups(); // { uniqueKey: groupDetails }

    // 过滤可选的权限组 (自己或主人创建的，且权限允许)
    const areaOwnerUuid = area.ownerUuid || null;
    const filteredGroupEntries = Object.entries(allAvailableGroups)
        .filter(([uniqueKey, group]) => {
             const isCreatorSelf = group.creatorUuid === player.uuid;
             const isCreatorOwner = areaOwnerUuid && group.creatorUuid === areaOwnerUuid;
             const isOwnOrOwnerGroup = isCreatorSelf || isCreatorOwner;
             const canSelectGroup = hasAdminRight || !groupHasAdminPermissions(group);
             return isOwnOrOwnerGroup && canSelectGroup;
        });

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
             const group = allAvailableGroups[key];
             // 精确匹配
             if (group.originalGroupName === currentDefaultGroupName && group.creatorUuid) {
                  const targetKey = `${currentDefaultGroupName}_${group.creatorUuid}`;
                  const foundGroup = allAvailableGroups[targetKey];
                  if (foundGroup) {
                       currentDefaultDetails = foundGroup;
                       break;
                  }
             }
             // Fallback
             else if (group.originalGroupName === currentDefaultGroupName) {
                  currentDefaultDetails = group; // 可能不精确
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

    // --- 修改开始: 使用手动计数器代替 fm.content.length ---
    let elementIndex = 0; // 初始化控件索引计数器

    // 添加可能存在的 Label (如果当前默认组不在可选列表或未找到)
    if (currentDefaultGroupName) {
        // ... (查找 currentDefaultDetails 的逻辑保持不变) ...
        if (currentDefaultDetails) {
            const currentUniqueKey = `${currentDefaultDetails.originalGroupName}_${currentDefaultDetails.creatorUuid}`;
            const idx = filteredGroupEntries.findIndex(([key, group]) => key === currentUniqueKey);
            if (idx !== -1) {
                currentIndex = idx + 1;
            } else {
                const currentDefaultDisplay = `${currentDefaultDetails.name} (${currentDefaultGroupName}) [§b${currentDefaultDetails.creatorName}§r]`;
                fm.addLabel(`§e当前默认组: ${currentDefaultDisplay} (你无权选择此组)`);
                elementIndex++; // 增加计数器
            }
        } else {
            fm.addLabel(`§e当前默认组: ${currentDefaultGroupName} (未找到详情)`);
            elementIndex++; // 增加计数器
        }
    }

    fm.addLabel("§e选择一个权限组作为该区域的默认权限组\n§7未设置特定权限组的玩家将使用此权限组");
    elementIndex++; // 增加计数器

    // 检查 groupOptions 是否为数组
    if (!Array.isArray(groupOptions)) {
         logError(`[showAreaDefaultGroupForm] groupOptions is not an array for area ${areaId}! Value: ${JSON.stringify(groupOptions)}`);
         player.tell("§c创建表单时发生内部错误 (code: F2)。");
         showPermissionManageForm(player, areaId, origin);
         return;
    }
    const dropdownItems = groupOptions.map(o => o.text);
     // 检查 dropdownItems 是否为数组
     if (!Array.isArray(dropdownItems)) {
         logError(`[showAreaDefaultGroupForm] dropdownItems is not an array after map for area ${areaId}! Value: ${JSON.stringify(dropdownItems)}`);
         player.tell("§c创建表单时发生内部错误 (code: F3)。");
         showPermissionManageForm(player, areaId, origin);
         return;
     }

    // 使用计数器确定索引
    const dropdownIndex = elementIndex;
    fm.addDropdown("选择默认权限组", dropdownItems, currentIndex);
    elementIndex++; // 增加计数器

    const backSwitchIndex = elementIndex;
    fm.addSwitch("§c返回", false);
    elementIndex++; // 增加计数器
    // --- 修改结束 ---


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

            // 再次验证权限 (理论上过滤已完成，保留更安全)
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
            resetCache(); // 清理缓存
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
                `§c确定要删除权限组 "${group.name}" (${groupId}) 吗？\n此操作不可撤销！\n§e使用此权限组的区域/玩家将恢复默认权限。`, // content
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

// --- 新增函数：查看权限组应用情况 ---
function showGroupUsageForm(player, areaId, origin) {
    const myGroups = getPlayerCustomGroups(player.uuid); // 获取当前玩家创建的所有组
    const groupIds = Object.keys(myGroups);

    if (groupIds.length === 0) {
        player.tell("§c你还没有创建任何权限组，无法查看应用情况。");
        showGroupManageForm(player, areaId, origin);
        return;
    }

    const fm = mc.newSimpleForm();
    fm.setTitle("权限组应用情况");
    fm.setContent("选择一个你创建的权限组，查看它被哪些区域使用：");

    const groupDisplayMap = {}; // 用于映射按钮 ID 到 group ID

    groupIds.forEach((gid, index) => {
        const group = myGroups[gid];
        fm.addButton(`${group.name} (${gid})`, "textures/ui/icon_recipe_item");
        groupDisplayMap[index] = gid; // 映射按钮索引到权限组 ID
    });

    fm.addButton("§c返回", "textures/ui/cancel");
    const backButtonIndex = groupIds.length;

    player.sendForm(fm, (player, id) => {
        if (id === null || id === backButtonIndex) {
            showGroupManageForm(player, areaId, origin);
            return;
        }

        const selectedGroupId = groupDisplayMap[id]; // 获取选中的权限组 ID
        if (!selectedGroupId) {
            player.tell("§c无效的选择。");
            showGroupUsageForm(player, areaId, origin); // 重新显示
            return;
        }

        const groupName = myGroups[selectedGroupId].name;
        let usageInfo = `§l权限组 "${groupName}" (${selectedGroupId}) 应用于以下区域：§r\n\n`;
        let foundUsage = false;

        try {
            const db = getDbSession();

            // 1. 查找将此组设为默认权限的区域
            const defaultStmt = db.prepare("SELECT areaId FROM default_groups WHERE groupName = ?");
            defaultStmt.bind(selectedGroupId);
            const defaultAreas = [];
            while (defaultStmt.step()) {
                defaultAreas.push(defaultStmt.fetch().areaId);
            }

            if (defaultAreas.length > 0) {
                foundUsage = true;
                usageInfo += "§e作为默认权限组:§r\n";
                const areaDetails = getAreaData(); // 获取所有区域数据以显示名称
                defaultAreas.forEach(aid => {
                    const areaName = areaDetails[aid]?.name || `未知区域 (${aid.substring(0, 6)}...)`;
                    usageInfo += `- ${areaName} (${aid})\n`;
                });
                usageInfo += "\n";
            }

            // 2. 查找将此组设为特定玩家权限的区域
            const specificStmt = db.prepare("SELECT DISTINCT areaId FROM permissions WHERE groupName = ?");
            specificStmt.bind(selectedGroupId);
            const specificAreas = [];
            while (specificStmt.step()) {
                 const currentAreaId = specificStmt.fetch().areaId;
                 // 确保不重复添加已在默认列表中的区域
                 if (!defaultAreas.includes(currentAreaId)) {
                      specificAreas.push(currentAreaId);
                 }
            }

            if (specificAreas.length > 0) {
                foundUsage = true;
                usageInfo += "§e作为特定玩家权限组:§r\n";
                const areaDetails = getAreaData(); // 再次获取以防万一
                specificAreas.forEach(aid => {
                    const areaName = areaDetails[aid]?.name || `未知区域 (${aid.substring(0, 6)}...)`;
                    usageInfo += `- ${areaName} (${aid})\n`;
                });
                 usageInfo += "\n";
            }

        } catch (e) {
            logError(`查询权限组 ${selectedGroupId} 应用情况失败: ${e}`, e.stack);
            player.tell("§c查询应用情况时出错！");
            showGroupUsageForm(player, areaId, origin);
            return;
        }

        if (!foundUsage) {
            usageInfo += "§7(此权限组当前未被任何区域使用)";
        }

        // 显示结果表单
        const resultFm = mc.newSimpleForm();
        resultFm.setTitle(`应用情况 - ${groupName}`);
        resultFm.setContent(usageInfo);
        resultFm.addButton("§c返回列表", "textures/ui/cancel");

        player.sendForm(resultFm, (player, id) => {
            showGroupUsageForm(player, areaId, origin); // 返回权限组列表
        });
    });
}


// 导出函数
module.exports = {
    showPermissionManageForm,
    showGroupManageForm,
    showAreaDefaultGroupForm,
    showMemberListForm, // 只显示特定权限成员
    showMemberEditForm,
    showAddMemberForm,
    showGroupListForm, // 显示自己的组
    showGroupEditForm,
    showCreateGroupForm,
    showAllPlayersPermissionForm, // 新增：管理所有玩家权限
    showGroupUsageForm // 新增：查看权限组应用情况
};
