// 初始化必要的变量和存储
let areaData = {};
let explodedBlockPositions = [];
const CONFIG_PATH = "./plugins/AreaManager/config.json";
let configFile;
const { Event } = require('./GMLIB-LegacyRemoteCallApi/lib/EventAPI-JS');
const defaultConfig = JSON.stringify({
  "defaultPermGroups": ["admin", "member", "guest"],
  "defaultPlayerPermissionGroup": "member",
  "customShulkerIds": ["minecraft:shulker_box"]
});

try {
    // 如果 config.json 不存在，则自动创建，默认内容为：{"defaultPermGroups": ["admin", "member", "guest"]}
    configFile = new JsonConfigFile(CONFIG_PATH, defaultConfig);
} catch (e) {
    logger.error("加载配置文件失败: " + e);
}
// 初始化配置项 "defaultPermGroups"，若不存在则写入默认值
// 分别初始化配置项，确保数据类型正确
let defaultPermGroups = configFile.init("defaultPermGroups", ["admin", "member", "guest"]);
let defaultPlayerPermissionGroup = configFile.init("defaultPlayerPermissionGroup", "member");
let customShulkerIds = configFile.init("customShulkerIds", ["minecraft:shulker_box"]);



// 注册插件
ll.registerPlugin(
    "AreaManager",  // 插件名字
    "区域管理插件", // 描述
    [1, 0, 0],     // 版本号
    {              // 其他信息
        Author: "Your Name"
    }
); 
const PERMISSIONS_DATA_PATH = "./plugins/AreaManager/permissionsData.json";
let permissionsData = {};
loadPermissionsData();


function loadPermissionsData() {
    try {
        let content = file.readFrom(PERMISSIONS_DATA_PATH);
        if (content) {
            permissionsData = JSON.parse(content);
        }
    } catch (e) {
        logger.error("加载区域权限数据失败: " + e);
    }
}

function savePermissionsData() {
    try {
        let jsonStr = JSON.stringify(permissionsData, null, 2);
        file.writeTo(PERMISSIONS_DATA_PATH, jsonStr);
    } catch (e) {
        logger.error("保存区域权限数据失败: " + e);
    }
}

// 创建配置文件管理器
const AREA_DATA_PATH = "./plugins/AreaManager/data.json";

const PERM_GROUPS_PATH = "./plugins/AreaManager/permGroups.json";
var permGroupsData = {};
let getAllPlayersInfoFunc = ll.import("PlayerData", "getOfflinePlayerData");
function getAllPlayersInfo() {
  if (typeof getAllPlayersInfoFunc !== "function") {
      logger.error("无法正确导入 getAllPlayersInfo 函数，请检查对应插件的接口导出。");
      return [];
  }
  try {
      return getAllPlayersInfoFunc();
  } catch (e) {
      logger.error("调用 getAllPlayersInfo 时出错: " + e);
      return [];
  }
}

// 加载权限组数据
function loadPermGroupsData() {
    try {
        let content = file.readFrom(PERM_GROUPS_PATH);
        if (content) {
            permGroupsData = JSON.parse(content);
        }
    } catch (e) {
        logger.error(`加载权限组数据失败: ${e}`);
    }
    // 如果文件为空，则初始化默认权限组
    if (Object.keys(permGroupsData).length === 0) {
      permGroupsData = {};
      defaultPermGroups.forEach(groupName => {
          if (groupName === "admin") {
            permGroupsData[groupName] = { 
              break: true, 
              place: true, 
              allowRename: true, 
              manage: true, 
              manageRules: true, // 增加新的规则管理权限
              attack: true,
              useframe: true,
              takeitem: true,    // 新增：admin允许捡起物品
              dropitem: true,    // 新增：admin允许丢出物品
              bedenter: true,         // 新增：允许上床
              interactentity: true,   // 新增：允许交互实体
              interactblock: true,    // 新增：允许与方块交互
              ride: true,             // 新增：允许骑乘实体
              armorstand: true,       // 新增：允许操控盔甲架
              open: { 
                chest: true,       // 箱子
                shulker: true,      // 潜影盒（通过配置文件 customShulkerIds 判断）
                hopper: true,       // 漏斗
                enderchest: true,   // 末影箱
                dispenser: true,    // 发射器
                dropper: true,      // 投掷器
                furnace: true,      // 熔炉
                blastfurnace: true, // 高炉
                grindstone: true,   // 砂轮
                 anvil: true,        // 铁砧（所有类型）
                barrel: true,       // 木桶
               crafter: true,      // 合成器
              trappedchest: true, // 陷阱箱
               crafting: true,     // 工作台
              enchanting: true,   // 附魔台
            cartography: true,  // 制图台
            smoker: true,       // 烟熏炉
            beacon: true,       // 信标
            stonecutter: true,  // 切石机
            brewingstand: true, // 酿造台
            smithing: true,
              container: true,     // 其他容器
              exceptions: [],
            }
          };
          } else if (groupName === "member") {
            permGroupsData[groupName] = { 
              break: true, 
              place: true, 
              allowRename: true, 
              manage: true, 
              manageRules: true, // 增加新的规则管理权限
              attack: true,
              useframe: true,
              takeitem: true,    // 新增：admin允许捡起物品
              dropitem: true,    // 新增：admin允许丢出物品
              bedenter: true,         // 新增：允许上床
              interactentity: true,   // 新增：允许交互实体
              interactblock: true,    // 新增：允许与方块交互
              ride: true,             // 新增：允许骑乘实体
              armorstand: true,       // 新增：允许操控盔甲架
              open: { 
                chest: true,       // 箱子
                shulker: true,      // 潜影盒（通过配置文件 customShulkerIds 判断）
                hopper: true,       // 漏斗
                enderchest: true,   // 末影箱
                dispenser: true,    // 发射器
                dropper: true,      // 投掷器
                furnace: true,      // 熔炉
                blastfurnace: true, // 高炉
                grindstone: true,   // 砂轮
            anvil: true,        // 铁砧（所有类型）
            barrel: true,       // 木桶
            crafter: true,      // 合成器
            trappedchest: true, // 陷阱箱
            crafting: true,     // 工作台
            enchanting: true,   // 附魔台
            cartography: true,  // 制图台
            smoker: true,       // 烟熏炉
            beacon: true,       // 信标
            stonecutter: true,  // 切石机
            brewingstand: true, // 酿造台
            smithing: true,
            container: true ,    // 其他容器
            exceptions: [],
            }
          };
          } else if (groupName === "guest") {
            permGroupsData[groupName] = { 
              break: true, 
              place: true, 
              allowRename: true, 
              manage: true, 
              manageRules: true, // 增加新的规则管理权限
              attack: true,
              useframe: true,
              takeitem: true,    // 新增：admin允许捡起物品
              dropitem: true,    // 新增：admin允许丢出物品
              bedenter: true,         // 新增：允许上床
              interactentity: true,   // 新增：允许交互实体
              interactblock: true,    // 新增：允许与方块交互
              ride: true,             // 新增：允许骑乘实体
              armorstand: true,       // 新增：允许操控盔甲架
              open: { 
                chest: true,       // 箱子
                shulker: true,      // 潜影盒（通过配置文件 customShulkerIds 判断）
                hopper: true,       // 漏斗
                enderchest: true,   // 末影箱
                dispenser: true,    // 发射器
                dropper: true,      // 投掷器
                furnace: true,      // 熔炉
                blastfurnace: true, // 高炉
                grindstone: true,   // 砂轮
            anvil: true,        // 铁砧（所有类型）
            barrel: true,       // 木桶
            crafter: true,      // 合成器
            trappedchest: true, // 陷阱箱
            crafting: true,     // 工作台
            enchanting: true,   // 附魔台
            cartography: true,  // 制图台
            smoker: true,       // 烟熏炉
            beacon: true,       // 信标
            stonecutter: true,  // 切石机
            brewingstand: true, // 酿造台
            smithing: true,
            container: true,     // 其他容器
            exceptions: []
            }
          };
          }
      });
      savePermGroupsData();
  }
}

// 保存权限组数据
function savePermGroupsData() {
    try {
        let jsonStr = JSON.stringify(permGroupsData, null, 2);
        file.writeTo(PERM_GROUPS_PATH, jsonStr);
    } catch (e) {
        logger.error(`保存权限组数据失败: ${e}`);
    }
}

// 在插件初始化时加载权限组数据
loadPermGroupsData();


// 加载数据
function loadAreaData() {
    try {
        let content = file.readFrom(AREA_DATA_PATH);
        if (content) {
            areaData = JSON.parse(content);
            logger.info(`默认权限组列表：${defaultPermGroups.join(", ")}`);
           logger.info(`默认玩家权限组：${defaultPlayerPermissionGroup}`);
        }
    } catch (e) {
        logger.error(`加载区域数据失败: ${e}`);
    }
} 

// 保存数据
function saveAreaData() {
    try {
        let jsonStr = JSON.stringify(areaData, null, 2);
        file.writeTo(AREA_DATA_PATH, jsonStr);
    } catch (e) {
        logger.error(`保存区域数据失败: ${e}`);
    }
} 

// 注册命令
mc.listen("onServerStarted", () => {
    const cmd = mc.newCommand("area", "区域管理", PermType.Any);
    cmd.setEnum("action", ["pos1", "pos2", "create"]);
    cmd.optional("nickname", ParamType.String);
    cmd.optional("action", ParamType.Enum, "action");
    
    cmd.overload([]); // 无参数的情况
    cmd.overload(["action"]);
    cmd.overload(["action", "nickname"]);

    cmd.setCallback((_cmd, origin, output, results) => {
        let player = origin.player;
        if (!player) {
            output.error("该命令只能由玩家执行！");
            return;
        }
         // 当没有参数时显示管理界面
        if (!results.action) {
        showMainForm(player);
        return;
                              }

        switch (results.action) {
            case "pos1":
                handlePos1(player);
                break;
            case "pos2":
                handlePos2(player);
                break;
            case "create":
                handleCreate(player);
                break;
        }
    });
    
    cmd.setup();
});

// 临时存储玩家选择的点
let playerTempPoints = {};

function handlePos1(player) {
    let pos = player.pos;
    if (!playerTempPoints[player.uuid]) {
        playerTempPoints[player.uuid] = {};
    }
    playerTempPoints[player.uuid].pos1 = {
        x: Math.floor(pos.x),
        y: Math.floor(pos.y),
        z: Math.floor(pos.z),
        dim : pos.dimid
    };
    
    playerTempPoints[player.uuid].dimid1 = player.pos.dimid;
    player.tell("§a已设置区域点1");
} 

function handlePos2(player) {
    let pos = player.pos;
    if (!playerTempPoints[player.uuid]) {
        playerTempPoints[player.uuid] = {};
    }
    playerTempPoints[player.uuid].pos2 = {
        x: Math.floor(pos.x),
        y: Math.floor(pos.y),
        z: Math.floor(pos.z)
    };

    playerTempPoints[player.uuid].dimid2 = player.pos.dimid;
    player.tell("§a已设置区域点2");
} 

function handleCreate(player) {
    let points = playerTempPoints[player.uuid];
    if (!points || !points.pos1 || !points.pos2) {
        player.tell("§c请先设置两个点！");
        return;
    }
        // 检查是否在同一维度
        if (playerTempPoints[player.uuid].dimid1 !== playerTempPoints[player.uuid].dimid2) {
            player.tell("§c错误：两个点必须在同一维度！");
            return;
        }
    
    // 显示创建确认表单
    showAreaCreateForm(player, points);
}

// 创建区域确认表单
function showAreaCreateForm(player, points, nickname = "") {
    let form = mc.newCustomForm();
    form.setTitle("创建区域确认");
    
    // 添加表单组件
    form.addLabel("§e== 区域信息 ==");
    form.addInput("区域名称", "请输入区域名称", nickname);
    form.addLabel(`起点坐标: ${points.pos1.x}, ${points.pos1.y}, ${points.pos1.z}`);
    form.addLabel(`终点坐标: ${points.pos2.x}, ${points.pos2.y}, ${points.pos2.z}`);
    
    // 计算区域大小
    let size = {
        x: Math.abs(points.pos2.x - points.pos1.x) + 1,
        y: Math.abs(points.pos2.y - points.pos1.y) + 1,
        z: Math.abs(points.pos2.z - points.pos1.z) + 1
    };
    form.addLabel(`区域大小: ${size.x}x${size.y}x${size.z}`);
    
    // 发送表单给玩家
    player.sendForm(form, (player, data) => {
        if (data === null) {
            player.tell("§c已取消创建区域！");
            return;
        }
        let newArea = {
          pos1: points.pos1,
          pos2: points.pos2
      };
      if (isAreaOverlap(newArea)) {
          player.tell("§c该区域与现有区域重叠，创建失败！");
          return;
      }
        // 获取表单数据
        let areaName = data[1].trim() || "未命名区域";
        
        // 生成唯一ID
        let areaId = generateUniqueId();
        
        // 保存区域数据
        areaData[areaId] = {
            pos1: points.pos1,
            pos2: points.pos2,
            ownerxuid: player.xuid,
            ownerUuid: player.uuid,  // 新增UUID记录
            nickname: areaName,
            createTime: new Date().getTime(),
            size: size
        };
        
        saveAreaData();
        player.tell(`§a区域创建成功！\n§e区域ID: ${areaId}\n§e区域名称: ${areaName}`);
        
        // 清除临时数据
        delete playerTempPoints[player.uuid];
    });
}

function showMainForm(player) {
  let form = mc.newSimpleForm();
  form.setTitle("§l§6区域管理系统");
  form.setContent("§e请选择要进行的操作：");

  // 添加功能按钮
  form.addButton("§a创建新区域\n§7点击开始创建保护区域", "textures/ui/confirm");
  form.addButton("§e我的区域列表\n§7查看已创建的区域", "textures/ui/map_icon");
  form.addButton("§b管理脚下区域\n§7直接管理你脚下的区域", "textures/ui/gear");
  form.addButton("§c关闭菜单\n§7点击关闭本界面", "textures/ui/cancel");

  player.sendForm(form, (player, id) => {
      if (id === null) return;
      switch(id) {
          case 0: // 创建新区域
              player.tell("§a请先使用/area pos1和/area pos2设置区域范围");
              break;
          case 1: // 区域列表
              showAreaListForm(player);
              break;
          case 2: // 管理脚下区域
              handleAreaAtFeet(player);
              break;
          case 3: // 关闭
              break;
      }
  });
}

function handleAreaAtFeet(player) {
  let pos = player.pos;
  let foundAreas = [];
  for (let id in areaData) {
      let area = areaData[id];
      if (isPosInArea(pos, area)) {
          foundAreas.push(id);
      }
  }
  if (foundAreas.length === 0) {
      player.tell("§c你脚下没有任何区域！");
      return;
  } else if (foundAreas.length > 1) {
      player.tell("§c你脚下存在多个区域，请使用区域列表进行选择管理！");
      return;
  }
  // 当仅有一个区域时，直接进入管理界面
  let areaId = foundAreas[0];
  if (!hasPermission(player, areaId, "manage")) {
      player.tell("§c你没有权限管理你脚下的区域！");
      return;
  }
  showAreaOperateForm(player, areaId);
}

/**
 * 显示区域列表表单
 * @param {Player} player 玩家对象
 * @param {number} currentPage 当前页码（从0开始），默认为0
 * @param {string} filter 搜索关键词，默认为空字符串
 */
function showAreaListForm(player, currentPage, filter) {
    if (typeof currentPage === "undefined") currentPage = 0;
    if (typeof filter === "undefined") filter = "";
    
    // 收集玩家拥有的区域
    let allAreas = [];
    for (let id in areaData) {
      if (hasPermission(player, id, "manage")) {
        let area = areaData[id];
        area.id = id;
        allAreas.push(area);
      }
    }
    
    // 根据搜索关键词过滤区域（如果输入了关键词）
    let filteredAreas = allAreas;
    if (filter.trim() !== "") {
        filteredAreas = allAreas.filter(area => (area.nickname || "").includes(filter));
      }
    
    // 分页设置：每页显示最多 pageSize 个区域
    let pageSize = 5;
    let totalPages = Math.ceil(filteredAreas.length / pageSize);
    if (totalPages < 1) totalPages = 1;
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    let startIndex = currentPage * pageSize;
    let endIndex = Math.min(startIndex + pageSize, filteredAreas.length);
    let pageAreas = filteredAreas.slice(startIndex, endIndex);
    
    // 创建自定义表单
    let fm = mc.newCustomForm();
    fm.setTitle("区域列表");
    
    // 在顶部增加搜索输入框（默认填入当前的关键词，以便连续搜索）
    fm.addInput("搜索关键词", "输入区域名称", filter);
    
    // 使用开关展示当前页内的区域，每个开关用于标识该区域是否已选中
    for (let i = 0; i < pageAreas.length; i++) {
      let area = pageAreas[i];
      let switchLabel = `${area.nickname} (ID: ${area.id})`;
      fm.addSwitch(switchLabel, false);
    }
    
    // 在区域列表的下方增加“完成选择”开关
    fm.addSwitch("完成选择", false);
    
    // 添加步进滑块，用于分页切换（使用“第X页”作为提示，每页标号从1开始，但返回值从0开始）
    let sliderItems = [];
    for (let i = 0; i < totalPages; i++) {
      sliderItems.push("第" + (i + 1) + "页");
    }
    fm.addStepSlider("选择页码", sliderItems, currentPage);
    
    // 发送表单给玩家，并处理回调数据
    player.sendForm(fm, (player, data) => {
      if (data === null) return; // 玩家取消了表单
      
      // 注意：表单返回的数据顺序如下：
      // data[0]                        => 搜索关键词输入框的文本
      // data[1] ~ data[1 + pageAreas.length - 1] => 每个区域的开关值（true/false）
      // data[1 + pageAreas.length]       => “完成选择”开关值（true/false）
      // data[1 + pageAreas.length + 1]   => 分页滑块返回的页码（数字，从0开始）
      
      let keyword = data[0].trim();
      let selectedAreas = [];
      for (let i = 0; i < pageAreas.length; i++) {
        if (data[1 + i] === true) {
          selectedAreas.push(pageAreas[i].id);
        }
      }
      let completeSwitch = data[1 + pageAreas.length];
      let chosenPage = data[1 + pageAreas.length + 1];
      
      // 1. 如果开启了完成选择且只选择了一个区域，则视为选择完成，返回调试信息
      if (completeSwitch && selectedAreas.length === 1) {
        // 调用区域操作表单，而不是直接输出调试信息
        showAreaOperateForm(player, selectedAreas[0]);
        return;
      }
      
      // 2. 如果未开启完成选择，但搜索输入框中有关键词，则显示搜索后的表单（只显示包含关键词的区域）
      if (!completeSwitch && keyword !== "") {
        showAreaListForm(player, 0, keyword);
        return;
      }
      
      // 3. 如果未开启完成选择且玩家通过滑块调整了页码，则跳转到所选择的页码
      if (!completeSwitch && chosenPage !== currentPage) {
        showAreaListForm(player, chosenPage, filter);
        return;
      }
      
      // 其他情况，返回调试信息（后续操作可继续扩展）
      player.tell("§e调试信息：表单提交，但未触发完成选择、搜索或分页跳转。");
    });
  }

/**
 * 辅助函数：根据操作类型从权限配置中取出对应的布尔值
 */
function checkPermissionByAction(permConfig, action) {
  const mapping = {
    rename: "allowRename",
    manage: "manage",
    break: "break",
    place: "place",
    manageRules: "manageRules",
    attack: "attack",
    openchest: "open.chest",
    openshulker: "open.shulker",
    openhopper: "open.hopper",
    openenderchest: "open.enderchest",
    opendispenser: "open.dispenser",
    opendropper: "open.dropper",
    openfurnace: "open.furnace",
    openblastfurnace: "open.blastfurnace",
    opengrindstone: "open.grindstone",
    openanvil: "open.anvil",
    openbarrel: "open.barrel",
    opencrafter: "open.crafter",
    opentrappedchest: "open.trappedchest",
    opencrafting: "open.crafting",
    openenchanting: "open.enchanting",
    opencartography: "open.cartography",
    opensmoker: "open.smoker",
    openbeacon: "open.beacon",
    openstonecutter: "open.stonecutter",
    openbrewingstand: "open.brewingstand",
    opensmithing: "open.smithing",
    opencontainer: "open.container",
    useframe: "useframe",
    takeitem: "takeitem",    
    dropitem: "dropitem",   
    bedenter: "bedenter",
    interactentity: "interactentity",
    interactblock: "interactblock",
    ride: "ride",
    armorstand: "armorstand",
  };

  let keyPath = mapping[action];
  if (!keyPath) {
    logger.info(`[checkPermissionByAction] 未知操作类型：${action}`);
    return false;
  }
  // 处理嵌套属性，例如 "open.chest"
  let keys = keyPath.split(".");
  let value = permConfig;
  for (let key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return false;
    }
  }
  return !!value;
}

function hasPermission(player, areaId, action) {
  logger.info(`[hasPermission] 检查权限开始：玩家UUID=${player.uuid}, 区域ID=${areaId}, 操作=${action}`);
  
  let area = areaData[areaId];
  if (!area) {
    logger.info(`[hasPermission] 区域 ${areaId} 不存在`);
    return false;
  }
  
  // 区域所有者拥有所有权限
  if (area.ownerxuid === player.xuid || area.ownerUuid === player.uuid) {
    logger.info(`[hasPermission] 玩家是区域所有者，自动允许操作`);
    return true;
  }
  
  // 获取该区域的权限数据，若没有则使用默认权限组
  let permForArea = permissionsData[areaId];
  let group = "";
  if (!permForArea) {
    group = configFile.get("defaultPlayerPermissionGroup", "");
    logger.info(`[hasPermission] 区域 ${areaId} 没有权限数据，使用默认权限组: ${group}`);
  } else {
    group = (permForArea.memberGroups && permForArea.memberGroups[player.uuid])
      ? permForArea.memberGroups[player.uuid]
      : configFile.get("defaultPlayerPermissionGroup", "");
    logger.info(`[hasPermission] 玩家权限组: ${group}`);
  }
  
  if (!group) {
    logger.info(`[hasPermission] 无法获取到有效权限组，拒绝操作`);
    return false;
  }
  
  let permConfig = permGroupsData[group];
  if (!permConfig) {
    logger.error(`[hasPermission] 权限组 ${group} 配置不存在`);
    return false;
  }
  
  let allowed = checkPermissionByAction(permConfig, action);
  logger.info(`[hasPermission] 检查结果：${allowed}`);
  return allowed;
}


/**
 * 显示区域操作表单，用于修改名称、删除区域以及权限管理
 * @param {Player} player 玩家对象
 * @param {string} areaId 区域ID
 */
/* 修改后的 showAreaOperateForm，增加判断是否允许管理区域 */
function showAreaOperateForm(player, areaId) {
  if (!areaData[areaId]) {
      player.tell("区域不存在！");
      return;
  }
  let area = areaData[areaId];
    // 在检查管理权限前调用 hasPermission 并增加调试日志
    let permForArea = permissionsData[areaId];
    let group = "";
    if (!permForArea) {
      // 如果该区域没有设置权限数据，则取配置文件中的默认权限组
      group = configFile.get("defaultPlayerPermissionGroup", "");
      logger.info(`[showAreaOperateForm] 区域 ${areaId} 无权限数据，默认使用权限组：${group}`);
    } else {
      // 获取该区域中针对当前玩家设置的权限组
      group = (permForArea.memberGroups && permForArea.memberGroups[player.uuid])
        ? permForArea.memberGroups[player.uuid]
        : configFile.get("defaultPlayerPermissionGroup", "");
      logger.info(`[showAreaOperateForm] 玩家 ${player.uuid} 在区域 ${areaId} 的权限组已设置为：${group}`);
    }
    let permConfig = permGroupsData[group];
    if (!permConfig) {
      logger.error(`[showAreaOperateForm] 权限组 ${group} 的配置不存在！`);
    } else {
      logger.info(`[showAreaOperateForm] 权限组 ${group} 的权限配置：${JSON.stringify(permConfig)}`);
    }
  
    // 检查管理权限前也使用 hasPermission 输出调试日志
    let hasManage = hasPermission(player, areaId, "manage");
    logger.info(`[showAreaOperateForm] 管理权限检查结果：玩家 ${player.uuid} 对区域 ${areaId} 的管理权限结果：${hasManage}`);
    if (!hasManage) {
      player.tell("你没有权限管理该区域！");
      return;
    }
  
  let form = mc.newSimpleForm();
  form.setTitle("区域操作");
  form.setContent(`区域名称：${area.nickname}\n请选择要进行的操作：`);
  
  form.addButton("修改名称", "textures/ui/rename");
  form.addButton("删除区域", "textures/ui/trash");
  form.addButton("规则管理", "textures/ui/lock");
  form.addButton("设置玩家权限组", "textures/ui/user");
  form.addButton("权限组管理", "textures/ui/gear");
  form.addButton("重新选择范围", "textures/ui/redirect");
  if (area.ownerUuid === player.uuid) {
    form.addButton("转让所有权", "textures/ui/transfer");
}
  player.sendForm(form, (player, id) => {
      if (id === null) return;
      if (area.ownerUuid === player.uuid && id === 6) {
        showAreaTransferOwnershipForm(player, areaId);
        return;
    }
      switch(id) {
          case 0:
              showAreaRenameForm(player, areaId);
              break;
          case 1:
              showAreaDeleteForm(player, areaId);
              break;
          case 2:
              showAreaPermissionForm(player, areaId);
              break;
          case 3:
              showPlayerSelectionFormForMemberGroup(player, areaId);
              break;
          case 4:
              showPermissionGroupsManagementForm(player);
              break;
          case 5:
              reselectAreaRange(player, areaId);
              break;
          default:
              player.tell("无效选择");
      }
  });
}
  
  
 /**
 * 显示修改区域名称的表单
 * @param {Player} player 玩家对象
 * @param {string} areaId 区域ID
 */
 function showAreaRenameForm(player, areaId) {
  if (!areaData[areaId]) {
    player.tell("区域不存在！");
    return;
  }
  
  // 判断玩家是否拥有修改名称的权限
  if (!hasPermission(player, areaId, "rename")) {
    player.tell("你没有修改区域名称的权限！");
    return;
  }
  
  let area = areaData[areaId];
  
  let fm = mc.newCustomForm();
  fm.setTitle("修改区域名称");
  // 添加输入控件，默认显示当前名称
  fm.addInput("请输入新的区域名称", "例如：我的领地", area.nickname);
  
  player.sendForm(fm, (player, data) => {
    if (data === null) {
      player.tell("已取消修改区域名称");
      return;
    }
    
    let newName = "";
    if (data[0] !== undefined && typeof data[0] === "string") {
      newName = data[0].trim();
    }
    
    if (newName === "") {
      player.tell("区域名称不能为空！");
      return;
    }
    areaData[areaId].nickname = newName;
    saveAreaData();
    player.tell(`区域名称已修改为：${newName}`);
  });
}
  
  /**
   * 显示删除区域的确认表单
   * @param {Player} player 玩家对象
   * @param {string} areaId 区域ID
   */
  function showAreaDeleteForm(player, areaId) {
    if (!areaData[areaId]) {
      player.tell("区域不存在！");
      return;
    }
    let area = areaData[areaId];
  
    // 只有区域主人才有删除权限
    if (!(area.ownerxuid === player.xuid || area.ownerUuid === player.uuid)) {
      player.tell("只有区域主人才能删除该区域！");
      return;
    }
  
    // 使用玩家对象的 sendModalForm 发送确认模式表单
    player.sendModalForm(
      "删除区域",
      `确定要删除区域 "${area.nickname}" 吗？此操作不可恢复！`,
      "确定删除",
      "取消",
      (player, result) => {
        // 如果 result 为 null 则代表玩家取消了表单
        if (result === null) return;
        if (result === true) {
          delete areaData[areaId];
          saveAreaData();
          player.tell("区域已被删除！");
        } else {
          player.tell("取消了删除操作");
        }
      }
    );
  }

  /* -------------------------------
   修改：设置玩家权限组的表单改为保存到 permissionsData
--------------------------------- */

/**
 * 显示设置玩家权限组的表单（区域所有者可操作）
 * 玩家输入目标玩家的 UUID 并选择权限组
 * @param {Player} player 当前区域所有者
 * @param {string} areaId 区域ID
 */



/**
 * 显示区域权限管理表单，设置整体破坏、放置权限（保存至 permissionsData）
 * @param {Player} player
 * @param {string} areaId
 */
function showAreaPermissionForm(player, areaId) {
  if (!areaData[areaId]) {
    player.tell("区域不存在！");
    return;
  }
  if (!hasPermission(player, areaId, "manageRules")) {
    player.tell("你没有权限管理区域规则！");
    return;
  }
  // 如果该区域还没有规则设置，则初始化默认规则
  if (!areaData[areaId].rules) {
    areaData[areaId].rules = {
      allowWitherSkullExplode: true,   // 新增：控制 wither_skull_dangerous 与 wither_skull 类型爆炸
      allowWitherExplode: true,
      allowMobSpawn: true,
      allowWitherBlockBreak: true,
      allowExplosionBlockDestruction: true,
      allowFarmlandDecay: true,            // 新增：允许耕地退化（true 代表允许退化）
      allowRespawnAnchorExplode: true,
      allowBlockExplode: true,
      allowLiquidFlow: true,
      allowFireSpread: true,
      allowPistonPush: true,
      allowCreeperExplode: true,
      allowEnderCrystalExplode: true,
      allowFireballExplode: true,
      allowEndermanTake: true
    };
  }
  
  let currentRules = areaData[areaId].rules;
  
  // 创建自定义表单用于区域规则设置
  let fm = mc.newCustomForm();
  fm.setTitle("区域规则管理");
  fm.addSwitch("允许凋灵之首爆炸）", currentRules.allowWitherSkullExplode);
  fm.addSwitch("允许凋灵爆炸", currentRules.allowWitherExplode);
  fm.addSwitch("允许凋零破坏方块", currentRules.allowWitherBlockBreak);
  fm.addSwitch("允许实体自然生成", currentRules.allowMobSpawn);
  fm.addSwitch("允许爆炸摧毁区域内的方块", currentRules.allowExplosionBlockDestruction);
  fm.addSwitch("允许耕地退化", currentRules.allowFarmlandDecay);
  fm.addSwitch("允许重生锚爆炸", currentRules.allowRespawnAnchorExplode);
  fm.addSwitch("允许区域内的方块爆炸", currentRules.allowBlockExplode);
  fm.addSwitch("允许液体流入区域", currentRules.allowLiquidFlow); 
  fm.addSwitch("允许火焰蔓延", currentRules.allowFireSpread);
  fm.addSwitch("允许外面的活塞影响区域内", currentRules.allowPistonPush);
  fm.addSwitch("允许苦力怕爆炸", currentRules.allowCreeperExplode);
  fm.addSwitch("允许末影水晶爆炸", currentRules.allowEnderCrystalExplode);
  fm.addSwitch("允许火球爆炸", currentRules.allowFireballExplode);
  fm.addSwitch("允许末影人搬起区域内的方块", currentRules.allowEndermanTake);
  
  // 发送表单并处理回调
  player.sendForm(fm, (player, data) => {
      if (data === null) {
          player.tell("已取消规则设置。");
          return;
      }
      
      // 更新区域数据中的规则设置
      areaData[areaId].rules = {
        allowWitherSkullExplode: data[0],
        allowWitherExplode: data[1],
        allowWitherBlockBreak: data[2],
        allowMobSpawn: data[3],
        allowExplosionBlockDestruction: data[4],
        allowFarmlandDecay: data[5],
        allowRespawnAnchorExplode: data[6],
        allowBlockExplode: data[7],
        allowLiquidFlow: data[8],
        allowFireSpread: data[9],
        allowPistonPush: data[10],
        allowCreeperExplode: data[11],
        allowEnderCrystalExplode: data[12],
        allowFireballExplode: data[13],
        allowEndermanTake: data[14]
      };
      
      // 将更新保存到 data.json 文件中
      saveAreaData();
      
      player.tell(`区域规则已更新`);
  });
}

  function isPosInArea(pos, area) {
    if (!area.pos1 || !area.pos2) return false;
    let minX = Math.min(area.pos1.x, area.pos2.x);
    let maxX = Math.max(area.pos1.x, area.pos2.x);
    let minY = Math.min(area.pos1.y, area.pos2.y);
    let maxY = Math.max(area.pos1.y, area.pos2.y);
    let minZ = Math.min(area.pos1.z, area.pos2.z);
    let maxZ = Math.max(area.pos1.z, area.pos2.z);
    
    // 检查维度是否一致（以区域第一个点的维度为参考）
    if (pos.dimid !== area.pos1.dim) return false;
    
    return (pos.x >= minX && pos.x <= maxX &&
            pos.y >= minY && pos.y <= maxY &&
            pos.z >= minZ && pos.z <= maxZ);
}

// 辅助函数：获取传入坐标所在的所有区域
function getAreasAtPos(pos) {
  let areas = [];
  for (let id in areaData) {
    let area = areaData[id];
    if (isPosInArea(pos, area)) {
      areas.push({ id, area });
    }
  }
  return areas;
}

mc.listen("onDestroyBlock", (player, block) => {
  if (!player || !block) return;
  let areas = getAreasAtPos(block.pos);
  for (let { id } of areas) {
          if (!hasPermission(player, id, "break")) {
              player.tell("§c你没有权限破坏该区域内的方块！");
              return false;
          }
      }
  
});

mc.listen("onPlaceBlock", (player, block, face) => {
  if (!player || !block) return;
  let areas = getAreasAtPos(block.pos);
  for (let { id } of areas) {
          if (!hasPermission(player, id, "place")) {
              player.tell("§c你没有权限在该区域内放置方块！");
              return false;
          }
      
  }
});

mc.listen("onAttackEntity", (player, entity, damage) => {
  if (!player || !entity) return true;
  let areas = getAreasAtPos(entity.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "attack")) {
      player.tell("§c你没有权限攻击实体！");
      return false; // 拦截攻击事件
    }
  }
  return true;
});

mc.listen("onMobHurt", (mob, source, damage, cause) => {
  // 如果 mob 或 source 不存在，则不拦截
  if (!mob || !source) return true;
  // 尝试将损伤来源转换为玩家对象
  let player = source.toPlayer ? source.toPlayer() : null;
  if (!player) return true;
  
  // 获取受伤实体所在的所有区域
  let areas = getAreasAtPos(mob.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "attack")) {
      player.tell("§c你没有权限攻击该生物！");
      return false; // 拦截伤害事件
    }
  }
  
  return true; // 允许伤害
});

// 修改后的 onOpenContainer 事件代码
mc.listen("onOpenContainer", (player, block) => {
  if (!player || !block) return;
  const pos = block.pos;
  const permissionMapping = {
    "minecraft:chest": "openchest",
    "minecraft:hopper": "openhopper",
    "minecraft:ender_chest": "openenderchest",
    "minecraft:dispenser": "opendispenser",
    "minecraft:dropper": "opendropper",
    "minecraft:furnace": "openfurnace",
    "minecraft:blast_furnace": "openblastfurnace",
    "minecraft:grindstone": "opengrindstone",
    "minecraft:anvil": "openanvil",
    "minecraft:chipped_anvil": "openanvil",
    "minecraft:damaged_anvil": "openanvil",
    "minecraft:barrel": "openbarrel",
    "minecraft:crafter": "opencrafter",
    "minecraft:trapped_chest": "opentrappedchest",
    "minecraft:crafting_table": "opencrafting",
    "minecraft:enchanting_table": "openenchanting",
    "minecraft:cartography_table": "opencartography",
    "minecraft:smoker": "opensmoker",
    "minecraft:beacon": "openbeacon",
    "minecraft:stonecutter": "openstonecutter",
    "minecraft:brewing_stand": "openbrewingstand",
    "minecraft:smithing_table": "opensmithing"
  };

// 如果 block.type 属于自定义潜影盒（shulker）类型，则返回相应操作名称
let action = permissionMapping[block.type] || (customShulkerIds.includes(block.type) ? "openshulker" : null);
  
// 从当前位置获取所有管辖的区域
let areas = getAreasAtPos(pos);
// 默认允许打开容器
let allowOpen = true;

for (let { id } of areas) {
  if (action) {
    if (!hasPermission(player, id, action)) {
      player.tell(`§c你没有权限在此区域内打开 ${block.type}！`);
      allowOpen = false;
      break;
    }
  } else {
    // 如果当前容器类型不在映射中，则采用 opencontainer 配置进行判断
    let defaultAllowed = hasPermission(player, id, "opencontainer");
    let group = (permissionsData[id]?.memberGroups?.[player.uuid]) || configFile.get("defaultPlayerPermissionGroup", "");
    let permConfig = permGroupsData[group];
    let exceptionsList = (permConfig?.open?.exceptions)
        ? permConfig.open.exceptions.map(x => x.toLowerCase())
        : [];
    let blockType = block.type.toLowerCase();
    if ((defaultAllowed && exceptionsList.includes(blockType))
        || (!defaultAllowed && !exceptionsList.includes(blockType))) {
      player.tell("§c你没有权限在此区域内打开该容器！");
      allowOpen = false;
      break;
    }
  }
}
return allowOpen;
});

// 监听操作物品展示框事件
mc.listen("onUseFrameBlock", function(player, block) {
  if (!player || !block) return true; // 参数无效时默认允许

  // 获取该方块所在的所有区域
  let areas = getAreasAtPos(block.pos);
  for (let { id } of areas) {
    // 检查玩家在该区域是否具有 useframe 权限
    if (!hasPermission(player, id, "useframe")) {
      player.tell("§c你没有权限操作物品展示框！");
      return false; // 拦截事件
    }
  }
  return true; // 允许操作
});

// 监听玩家捡起物品事件（onTakeItem）
// 监听函数原型：function(player, entity, item)
mc.listen("onTakeItem", (player, entity, item) => {
  if (!player || !entity || !item) return true; // 参数异常时放行
  // 获取当前玩家所在区域
  let areas = getAreasAtPos(player.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "takeitem")) {
      player.tell("§c你在该区域内没有权限捡起物品！");
      return false;  // 拦截捡起物品事件
    }
  }
  return true;
});

// 监听玩家丢出物品事件（onDropItem）
// 监听函数原型：function(player, item)
mc.listen("onDropItem", (player, item) => {
  if (!player || !item) return true;
  // 获取当前玩家所在区域
  let areas = getAreasAtPos(player.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "dropitem")) {
      player.tell("§c你在该区域内没有权限丢出物品！");
      return false;  // 拦截丢出物品事件
    }
  }
  return true;
});

// 玩家上床事件监听：onBedEnter
mc.listen("onBedEnter", (player, pos) => {
  let areas = getAreasAtPos(pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "bedenter")) {
      player.tell("§c你没有权限在该区域内使用床！");
      return false;
    }
  }
  return true;
});

/* 玩家交互实体事件监听：onPlayerInteractEntity
mc.listen("onPlayerInteractEntity", (player, entity) => {
  // 使用实体的坐标进行区域检测
  let areas = getAreasAtPos(entity.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "interactentity")) {
      player.tell("§c你没有权限在该区域内交互实体！");
      return false;
    }
  }
  return true;
});
*/
// 操控盔甲架事件监听：onChangeArmorStand
mc.listen("onChangeArmorStand", (as, pl, slot) => {
  let pos = as.pos;
  let areas = getAreasAtPos(pos);
  for (let { id } of areas) {
    if (!hasPermission(pl, id, "armorstand")) {
      pl.tell("§c你没有权限在该区域内操控盔甲架！");
      return false;
    }
  }
  return true;
});

// 方块交互事件监听：onBlockInteracted
mc.listen("onBlockInteracted", (player, block) => {
  let areas = getAreasAtPos(block.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "interactblock")) {
      player.tell("§c你没有权限在该区域内与方块交互！");
      return false;
    }
  }
  return true;
});

// 骑乘实体事件监听：onRide
mc.listen("onRide", (entity1, entity2) => {
  let player = entity1.toPlayer ? entity1.toPlayer() : null;
  if (!player) return true;
  let areas = getAreasAtPos(entity2.pos);
  for (let { id } of areas) {
    if (!hasPermission(player, id, "ride")) {
      player.tell("§c你没有权限在该区域内骑乘实体！");
      return false;
    }
  }
  return true;
});
// 监听实体尝试自然生成事件（onMobTrySpawn）
// 当自然生成的实体位置位于某个区域内，并且该区域规则禁止自然生成时，返回 false 拦截生成
mc.listen("onMobTrySpawn", function(typeName, pos) {
  // 遍历所有已注册的区域
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (isPosInArea(pos, area)) {
      // 从权限数据中获取区域规则，默认为允许自然生成
      let rule = (area.rules) ? area.rules : (permissionsData[areaId] || {});
      if (rule.allowMobSpawn === false) {
        logger.info(`拦截区域 [${areaId}] 内自然生成（type: ${typeName}）`);
        return false; // 拦截生成事件
      }
    }
  }
  return true; // 允许生成
});

// 监听实体爆炸事件（onEntityExplode）

// 修改后的爆炸事件监听，仅判断两种类型
mc.listen("onEntityExplode", function(source, pos, radius, maxResistance, isDestroy, isFire) {
  if (source && source.type) {
    const srcType = source.type.toLowerCase();
    for (let areaId in areaData) {
      let area = areaData[areaId];
      if (isPosInArea(pos, area)) {
        let rule = area.rules ? area.rules : (permissionsData[areaId] || {});
        // 针对凋灵之首（wither_skull_dangerous 与 wither_skull）的爆炸
        if (srcType === "minecraft:wither_skull_dangerous" || srcType === "minecraft:wither_skull") {
          if (rule.allowWitherSkullExplode === false) {
            logger.info(`拦截区域 [${areaId}] 内凋灵之首爆炸（类型：${source.type}）`);
            return false;
          }
        }
        // 针对 wither 爆炸（仅判断类型为 "wither"）
        else if (srcType === "minecraft:wither") {
          if (rule.allowWitherExplode === false) {
            logger.info(`拦截区域 [${areaId}] 内凋灵爆炸（类型：${source.type}）`);
            return false;
          }
        }
        // 新增判断：苦力怕爆炸
        else if (srcType === "minecraft:creeper") {
          if (rule.allowCreeperExplode === false) {
            logger.info(`拦截区域 [${areaId}] 内苦力怕爆炸（类型：${source.type}）`);
            return false;
          }
        }
        // 新增判断：末影水晶爆炸
        else if (srcType === "minecraft:ender_crystal") {
          if (rule.allowEnderCrystalExplode === false) {
            logger.info(`拦截区域 [${areaId}] 内末影水晶爆炸（类型：${source.type}）`);
            return false;
          }
        }
        else if (srcType === "minecraft:fireball") {
          if (rule.allowFireballExplode === false) {
            logger.info(`拦截区域 [${areaId}] 内火球爆炸（类型：${source.type}）`);
            return false;
          }
        }
      }
    }
  }
  return true;
});

mc.listen("onWitherBossDestroy", (witherBoss, AAbb, aaBB) => {
  // 计算凋灵破坏区域的中心点，用此点作为判断依据
  let center = {
    x: Math.floor((AAbb.x + aaBB.x) / 2),
    y: Math.floor((AAbb.y + aaBB.y) / 2),
    z: Math.floor((AAbb.z + aaBB.z) / 2),
    dimid: witherBoss.pos.dimid
  };

  // 遍历所有区域，使用 isPosInArea 检查中心点是否处于某个区域内
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (!area || !area.pos1 || !area.pos2) continue;
    if (isPosInArea(center, area)) {
      let rule = permissionsData[areaId] || {};
      if (rule.allowWitherBlockBreak === false) {
        logger.info(`拦截区域 [${areaId}] 内的凋灵破坏`);
        return false;
      }
    }
  }
  return true;
});

mc.listen("onBlockExploded", function(block, source) {
  let pos = block.pos;
  let originalType = block.type;
  let originalTileData = block.tileData;
  
  // 若为 TNT，不复原
  if (originalType === "minecraft:tnt") {
      logger.info("检测到TNT方块被爆炸，跳过复原：" + JSON.stringify(pos));
      return;
  }
  
  // 判断方块所在的位置是否位于设置了不允许爆炸摧毁的区域内
  let inProtectedArea = false;
  for (let id in areaData) {
    let area = areaData[id];
    if (isPosInArea(pos, area)) {
      let rule = (area.rules) ? area.rules : (permissionsData[areaId] || {});
      // 默认允许爆炸摧毁区域内方块，当配置明确为 false 时，认为区域不允许
      let allowExplosion = (rule.allowExplosionBlockDestruction !== undefined)
                           ? rule.allowExplosionBlockDestruction : true;
      if (!allowExplosion) {
        inProtectedArea = true;
        break;
      }
    }
  }
  
  // 如果所在区域允许爆炸摧毁，则跳过复原操作
  if (!inProtectedArea) {
    logger.info("区域规则允许爆炸破坏，跳过复原：" + JSON.stringify(pos));
    return;
  }
  
  // 记录被爆炸的方块位置，用于后续匹配掉落物生成事件
  explodedBlockPositions.push(pos);
  
  let blockNbt = block.getNbt();
  let blockEntity = block.getBlockEntity();
  let blockEntityNbt = null;
  if (blockEntity) {
    blockEntityNbt = blockEntity.getNbt();
  }
  
  // 延时后尝试复原被破坏的方块
  setTimeout(() => {
    let success = mc.setBlock(pos, originalType, originalTileData);
    if (success) {
      let newBlock = mc.getBlock(pos);
      if (newBlock) {
        if (blockNbt) {
          newBlock.setNbt(blockNbt);
        }
        if (blockEntityNbt) {
          let newBlockEntity = newBlock.getBlockEntity();
          if (newBlockEntity) {
            newBlockEntity.setNbt(blockEntityNbt);
          }
        }
      }
      logger.info("成功复原方块及其所有数据：" + originalType + " @ " + JSON.stringify(pos));
    } else {
      logger.info("复原方块失败 @ " + JSON.stringify(pos));
    }
  }, 50);
  
  // 延时清除记录
  setTimeout(() => {
    explodedBlockPositions = explodedBlockPositions.filter(p =>
      !(p.x === pos.x && p.y === pos.y && p.z === pos.z)
    );
  }, 100);
});

// 仅当掉落物生成位置与爆炸记录匹配时，拦截掉落物生成
Event.listen("onItemTrySpawn", (item, pos, entity) => {
  let isFromExplosion = explodedBlockPositions.some(p =>
      Math.abs(p.x - pos.x) <= 1 &&
      Math.abs(p.y - pos.y) <= 1 &&
      Math.abs(p.z - pos.z) <= 1
  );
  
  if (isFromExplosion) {
      logger.info("拦截爆炸方块附近的掉落物生成", pos, item, entity);
      return false; // 拦截掉落物生成
  }
  return true; // 允许其他情况的掉落物生成
});

// ── 新增事件监听：耕地退化 ──
mc.listen("onFarmLandDecay", function(pos, entity) {
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (isPosInArea(pos, area)) {
      let rule = (area.rules) ? area.rules : {};
      if (rule.allowFarmlandDecay === false) {
        logger.info(`拦截区域 [${areaId}] 内耕地退化，坐标: ${JSON.stringify(pos)}`);
        return false;
      }
    }
  }
  return true;
});

// ── 新增事件监听：重生锚爆炸 ──
mc.listen("onRespawnAnchorExplode", function(pos, player) {
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (isPosInArea(pos, area)) {
      let rule = (area.rules) ? area.rules : {};
      if (rule.allowRespawnAnchorExplode === false) {
        logger.info(`拦截区域 [${areaId}] 内重生锚爆炸，坐标: ${JSON.stringify(pos)}`);
        return false;
      }
    }
  }
  return true;
});

mc.listen("onBlockExplode", function(source, pos, radius, maxResistance, isDestroy, isFire) {
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (isPosInArea(pos, area)) {
      let rule = (area.rules) ? area.rules : {};
      if (rule.allowBlockExplode === false) {
        logger.info(`拦截区域 [${areaId}] 内方块爆炸，坐标: ${JSON.stringify(pos)}`);
        return false;
      }
    }
  }
  return true;
});

// ── 新增事件监听：火焰蔓延 ──
mc.listen("onFireSpread", function(pos) {
  // 遍历所有区域，检测火焰蔓延到的坐标是否在区域内
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (isPosInArea(pos, area)) {
      let rule = (area.rules) ? area.rules : {};
      if (rule.allowFireSpread === false) {
        logger.info(`拦截区域 [${areaId}] 内火焰蔓延，坐标: ${JSON.stringify(pos)}`);
        return false;
      }
    }
  }
  return true;
});




// ── 辅助函数：判断位置是否在指定区域的边界上 ──
function isPosOnAreaBoundary(pos, area) {
  if (pos.dimid !== area.pos1.dim) return false;
  let minX = Math.min(area.pos1.x, area.pos2.x);
  let maxX = Math.max(area.pos1.x, area.pos2.x);
  let minY = Math.min(area.pos1.y, area.pos2.y);
  let maxY = Math.max(area.pos1.y, area.pos2.y);
  let minZ = Math.min(area.pos1.z, area.pos2.z);
  let maxZ = Math.max(area.pos1.z, area.pos2.z);
  
  // 只要任一坐标等于区域的最小值或最大值，则认为该位置在边界上
  return pos.x === minX || pos.x === maxX ||
         pos.y === minY || pos.y === maxY ||
         pos.z === minZ || pos.z === maxZ;
}

// ── 修改后的 onLiquidFlow 事件监听（直接检测流动坐标是否在区域边界） ──
mc.listen("onLiquidFlow", function(from, to) {
  //logger.info(`[onLiquidFlow] 流动坐标: ${JSON.stringify(to)}`);
  
  // 遍历所有区域
  for (let areaId in areaData) {
    let area = areaData[areaId];
    // 先确认流动坐标在区域内
    if (isPosInArea(to, area)) {
      // 再判断是否在区域边界上
      if (isPosOnAreaBoundary(to, area)) {
        let rule = (area.rules) ? area.rules : {};
        //logger.info(`[onLiquidFlow] 区域 [${areaId}] 流动坐标在边界上，allowLiquidFlow = ${rule.allowLiquidFlow}`);
        if (rule.allowLiquidFlow === false) {
          //logger.info(`[onLiquidFlow] 拦截液体流入区域 [${areaId}] 边界, 坐标: ${JSON.stringify(to)}`);
          return false;
        }
      }
    }
  }
  return true;
});


// 监听 "onPistonTryPush" 事件
// 参数：pistonPos - 活塞的坐标 (IntPos)，block - 尝试被推动的方块对象
// 当方块位于某个区域内，而活塞不完全在区域内部（即位于区域外或正好在区域边界上），
// 并且该区域规则禁止外部或边界活塞推动时，拦截该事件（返回 false）
mc.listen("onPistonTryPush", function(pistonPos, block) {
  logger.info(`[onPistonTryPush] 事件触发：活塞位置：${JSON.stringify(pistonPos)}, 被推动方块位置：${JSON.stringify(block.pos)}`);

  // 遍历所有区域，检测是否有区域内的方块被外部或边界活塞推动
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (!area || !area.pos1 || !area.pos2) {
      logger.info(`[onPistonTryPush] 区域 ${areaId} 数据不完整，跳过检测`);
      continue;
    }

    // 检查被推动的方块是否在当前区域内
    if (isPosInArea(block.pos, area)) {
      logger.info(`[onPistonTryPush] 被推动方块位于区域 ${areaId}（名称：${area.nickname}）内`);

      // 判断活塞是否完全在该区域内部（即活塞既在区域内且不在区域边界上）
      let pistonInside = isPosInArea(pistonPos, area) && !isPosOnAreaBoundary(pistonPos, area);
      if (!pistonInside) {
        if (!isPosInArea(pistonPos, area)) {
          logger.info(`[onPistonTryPush] 活塞位置 ${JSON.stringify(pistonPos)} 不在区域 ${areaId} 内`);
        } else if (isPosOnAreaBoundary(pistonPos, area)) {
          logger.info(`[onPistonTryPush] 活塞位置 ${JSON.stringify(pistonPos)} 正在区域 ${areaId} 的边界上`);
        }

        let rule = area.rules;
        let allowPistonPush = rule && rule.allowPistonPush;
        logger.info(`[onPistonTryPush] 区域规则 allowPistonPush=${allowPistonPush}`);

        // 如果该区域规则明确禁止外部/边界活塞推动，则拦截该操作
        if (allowPistonPush === false) {
          logger.info(`[onPistonTryPush] 拦截操作：区域 ${areaId} 内的方块禁止被外部或边界活塞推动。`);
          return false;
        } else {
          logger.info(`[onPistonTryPush] 区域 ${areaId} 允许外部或边界活塞推动，继续检测其他区域（如果存在）。`);
        }
      } else {
        logger.info(`[onPistonTryPush] 活塞完全位于区域 ${areaId} 内，允许推动。`);
      }
    } else {
      logger.info(`[onPistonTryPush] 被推动方块不在区域 ${areaId} 内，继续检测下一个区域。`);
    }
  }

  logger.info(`[onPistonTryPush] 未检测到拦截条件，允许活塞推动。`);
  return true;
});
/*
Event.listen("onEndermanTake", function(entity) {
  if (!entity) return true;
  logger.info(`[onEndermanTake] 事件触发：末影人尝试搬起方块，坐标：${JSON.stringify(entity.type)}`);
  let pos = entity.blockPos;
  for (let areaId in areaData) {
    let area = areaData[areaId];
    if (isPosInArea(pos, area)) {
      let rule = area.rules ? area.rules : {};
      if (rule.allowEndermanTake === false) {
        logger.info(`拦截区域 [${areaId}] 内末影人搬起方块 (实体类型：末影人)`);
        return false; // 拦截末影人搬起区域内方块的行为
      }
    }
  }
  return true;
});
*/
/**
 * 检查新区域是否与已有区域重叠（仅判断同一维度下的区域）
 * @param {Object} newArea 新区域对象，必须包含 pos1 和 pos2
 * @returns {boolean} 如果存在重叠，则返回 true；否则返回 false
 */
function isAreaOverlap(newArea) {
  for (let id in areaData) {
      let existArea = areaData[id];
      if (!existArea || !existArea.pos1 || !existArea.pos2) continue;
      // 检查是否在同一维度（以 existArea.pos1.dim 为准）
      if (newArea.pos1.dim !== existArea.pos1.dim) continue;

      let newMinX = Math.min(newArea.pos1.x, newArea.pos2.x);
      let newMaxX = Math.max(newArea.pos1.x, newArea.pos2.x);
      let newMinY = Math.min(newArea.pos1.y, newArea.pos2.y);
      let newMaxY = Math.max(newArea.pos1.y, newArea.pos2.y);
      let newMinZ = Math.min(newArea.pos1.z, newArea.pos2.z);
      let newMaxZ = Math.max(newArea.pos1.z, newArea.pos2.z);

      let existMinX = Math.min(existArea.pos1.x, existArea.pos2.x);
      let existMaxX = Math.max(existArea.pos1.x, existArea.pos2.x);
      let existMinY = Math.min(existArea.pos1.y, existArea.pos2.y);
      let existMaxY = Math.max(existArea.pos1.y, existArea.pos2.y);
      let existMinZ = Math.min(existArea.pos1.z, existArea.pos2.z);
      let existMaxZ = Math.max(existArea.pos1.z, existArea.pos2.z);

      if (newMinX <= existMaxX && newMaxX >= existMinX &&
          newMinY <= existMaxY && newMaxY >= existMinY &&
          newMinZ <= existMaxZ && newMaxZ >= existMinZ) {
          // 存在交集，认为区域重叠
          return true;
      }
  }
  return false;
}


/**
 * 展示全局权限组管理的主界面：包含“修改权限组”、“添加权限组”、“删除权限组”
 * 仅允许有权限的玩家（一般为区域所有者或服务器管理者）操作
 */
function showPermissionGroupsManagementForm(player) {
  let form = mc.newSimpleForm();
  form.setTitle("权限组管理");
  form.setContent("请选择要进行的操作：");
  form.addButton("修改权限组");
  form.addButton("添加权限组");
  form.addButton("删除权限组");
  player.sendForm(form, (player, id) => {
      if (id === null) return;
      if (id === 0) {
          showModifyPermGroupSelectionForm(player);
      } else if (id === 1) {
          showAddPermGroupForm(player);
      } else if (id === 2) {
          showDeletePermGroupForm(player);
      }
  });
}

/**
 * 展示选择要修改的权限组（下拉菜单形式）
 */
function showModifyPermGroupSelectionForm(player) {
  let groups = [];
  for (let key in permGroupsData) {
    if (defaultPermGroups.includes(key) || (permGroupsData[key].owners && permGroupsData[key].owners.includes(player.uuid))) {
      groups.push(key);
    }
  }
  if (groups.length === 0) {
      player.tell("暂无权限组可供修改。");
      return;
  }
  let fm = mc.newCustomForm();
  fm.setTitle("选择权限组修改");
  fm.addDropdown("请选择权限组", groups, 0);
  player.sendForm(fm, (player, data) => {
      if (data === null) return;
      let selectedGroup = groups[data[0]];
      showModifyPermGroupForm(player, selectedGroup);
  });
}

/**
* 展示修改指定权限组的表单
* @param {Player} player 玩家对象 
* @param {string} groupName 权限组名称
*/
function showModifyPermGroupForm(player, groupName) {
  let group = permGroupsData[groupName];
  if (!group) {
      player.tell("权限组不存在。");
      return;
  }
  // 如果是默认权限组，则只允许查看，不允许修改
  if (defaultPermGroups.includes(groupName)) {
    let fm = mc.newCustomForm();
    fm.setTitle("查看默认权限组：" + groupName);
    fm.addLabel("权限组名称：" + groupName);
    fm.addLabel("允许破坏方块：" + (group.break ? "是" : "否"));
    fm.addLabel("允许放置方块：" + (group.place ? "是" : "否"));
    fm.addLabel("允许修改区域名称：" + (group.allowRename ? "是" : "否"));
    fm.addLabel("允许管理区域：" + (group.manage ? "是" : "否"));
    fm.addLabel("允许管理区域规则：" + ((group.manageRules) ? "是" : "否"));
    fm.addLabel("允许攻击实体：" + (group.attack ? "是" : "否"));
    fm.addLabel("允许操作物品展示框：" + ((group.useframe) ? "是" : "否"));
    fm.addLabel("允许捡起物品：" + (group.takeitem ? "是" : "否"));
    fm.addLabel("允许丢出物品：" + (group.dropitem ? "是" : "否"));
    fm.addLabel("允许使用床：" + (group.bedenter ? "是" : "否"));
    fm.addLabel("允许交互实体：" + (group.interactentity ? "是" : "否"));
    fm.addLabel("允许与方块交互：" + (group.interactblock ? "是" : "否"));
    fm.addLabel("允许骑乘实体：" + (group.ride ? "是" : "否"));
    fm.addLabel("允许操控盔甲架：" + (group.armorstand ? "是" : "否"));
    fm.addLabel("允许打开箱子：" + ((group.open && group.open.chest) ? "是" : "否"));
    fm.addLabel("允许打开潜影盒：" + ((group.open && group.open.shulker) ? "是" : "否"));
    fm.addLabel("允许打开漏斗：" + ((group.open && group.open.hopper) ? "是" : "否"));
    fm.addLabel("允许打开末影箱：" + ((group.open && group.open.enderchest) ? "是" : "否"));
    fm.addLabel("允许打开发射器：" + ((group.open && group.open.dispenser) ? "是" : "否"));
    fm.addLabel("允许打开投掷器：" + ((group.open && group.open.dropper) ? "是" : "否"));
    fm.addLabel("允许打开熔炉：" + ((group.open && group.open.furnace) ? "是" : "否"));
    fm.addLabel("允许打开高炉：" + ((group.open && group.open.blastfurnace) ? "是" : "否"));
    fm.addLabel("允许打开其他容器：" + ((group.open && typeof group.open.container === "boolean") ? (group.open.container ? "是" : "否") : "否"));
    fm.addLabel("允许打开砂轮：" + ((group.open && group.open.grindstone) ? "是" : "否"));
    fm.addLabel("允许打开铁砧：" + ((group.open && group.open.anvil) ? "是" : "否"));
    fm.addLabel("允许打开木桶：" + ((group.open && group.open.barrel) ? "是" : "否"));
    fm.addLabel("允许打开合成器：" + ((group.open && group.open.crafter) ? "是" : "否"));
    fm.addLabel("允许打开陷阱箱：" + ((group.open && group.open.trappedchest) ? "是" : "否"));
    fm.addLabel("允许打开工作台：" + ((group.open && group.open.crafting) ? "是" : "否"));
    fm.addLabel("允许打开附魔台：" + ((group.open && group.open.enchanting) ? "是" : "否"));
    fm.addLabel("允许打开制图台：" + ((group.open && group.open.cartography) ? "是" : "否"));
    fm.addLabel("允许打开烟熏炉：" + ((group.open && group.open.smoker) ? "是" : "否"));
    fm.addLabel("允许打开锻造台：" + ((group.open && group.open.smithing) ? "是" : "否"));
    fm.addLabel("允许打开信标：" + ((group.open && group.open.beacon) ? "是" : "否"));
    fm.addLabel("允许打开切石机：" + ((group.open && group.open.stonecutter) ? "是" : "否"));
    fm.addLabel("允许打开酿造台：" + ((group.open && group.open.brewingstand) ? "是" : "否"));
    fm.addLabel("允许此权限组让其他区域管理员赋权：" + ((group.allowAssignByManagers === false) ? "否" : "是"));
    fm.addLabel("允许操作物品展示框：" + ((group.useframe) ? "是" : "否"));
    fm.addLabel("允许打开锻造台：" + ((group.open && group.open.smithing) ? "是" : "否"));
    fm.addLabel("容器例外：" + ((group.open && group.open.exceptions && group.open.exceptions.length > 0) ? group.open.exceptions.join(", ") : "无"));
    fm.addLabel("默认权限组不可修改，仅供查看。");
    player.sendForm(fm, (player, data) => {
      player.tell("默认权限组为只读状态。");
    });
    return;
  }
  // 对于非默认权限组，只有创建者（owners）可以修改
  if (!group.owners || !group.owners.includes(player.uuid)) {
    player.tell("你没有权限修改该权限组！");
    return;
  }
  let fm = mc.newCustomForm();
  fm.setTitle("修改权限组：" + groupName);
  fm.addInput("修改权限组名称 (留空则保持不变)", "例如：vip", "");
  fm.addSwitch("允许破坏方块", group.break);
  fm.addSwitch("允许放置方块", group.place);
  fm.addSwitch("允许修改区域名称", group.allowRename);
  fm.addSwitch("允许管理区域", group.manage);
  fm.addSwitch("允许管理区域规则", group.manageRules ? true : false);
  fm.addSwitch("允许攻击实体", group.attack ? true : false);
  fm.addSwitch("允许打开箱子", (group.open && group.open.chest) ? true : false);
  fm.addSwitch("允许打开潜影盒", (group.open && group.open.shulker) ? true : false);
  fm.addSwitch("允许打开漏斗", (group.open && group.open.hopper) ? true : false);
  fm.addSwitch("允许打开末影箱", (group.open && group.open.enderchest) ? true : false);
  fm.addSwitch("允许打开发射器", (group.open && group.open.dispenser) ? true : false);
  fm.addSwitch("允许打开投掷器", (group.open && group.open.dropper) ? true : false);
  fm.addSwitch("允许打开熔炉", (group.open && group.open.furnace) ? true : false);
  fm.addSwitch("允许打开高炉", (group.open && group.open.blastfurnace) ? true : false);
  fm.addSwitch("其他容器", (group.open && typeof group.open.container === "boolean") ? group.open.container : false);
  fm.addSwitch("允许打开砂轮", (group.open && group.open.grindstone) ? true : false);
  fm.addSwitch("允许打开铁砧", (group.open && group.open.anvil) ? true : false);
  fm.addSwitch("允许打开木桶", (group.open && group.open.barrel) ? true : false);
  fm.addSwitch("允许打开合成器", (group.open && group.open.crafter) ? true : false);
  fm.addSwitch("允许打开陷阱箱", (group.open && group.open.trappedchest) ? true : false);
  fm.addSwitch("允许打开工作台", (group.open && group.open.crafting) ? true : false);
  fm.addSwitch("允许打开附魔台", (group.open && group.open.enchanting) ? true : false);
  fm.addSwitch("允许打开制图台", (group.open && group.open.cartography) ? true : false);
  fm.addSwitch("允许打开烟熏炉", (group.open && group.open.smoker) ? true : false);
  fm.addSwitch("允许打开锻造台", (group.open && group.open.smithing) ? true : false);
  fm.addSwitch("允许打开信标", (group.open && group.open.beacon) ? true : false);
  fm.addSwitch("允许打开切石机", (group.open && group.open.stonecutter) ? true : false);
  fm.addSwitch("允许打开酿造台", (group.open && group.open.brewingstand) ? true : false);
  fm.addSwitch("允许捡起物品", group.takeitem ? true : false);
  fm.addSwitch("允许丢出物品", group.dropitem ? true : false);
  fm.addSwitch("允许使用床", group.bedenter ? true : false);
  fm.addSwitch("允许交互实体", group.interactentity ? true : false);
  fm.addSwitch("允许与方块交互", group.interactblock ? true : false);
  fm.addSwitch("允许骑乘实体", group.ride ? true : false);
  fm.addSwitch("允许操控盔甲架", group.armorstand ? true : false);
  fm.addSwitch("允许此权限组让其他区域管理员赋权", group.allowAssignByManagers !== false);
  fm.addSwitch("允许操作物品展示框", group.useframe ? true : false);
  fm.addInput("容器例外（多个以逗号隔开）", "例如：mod:custom_container,mod:another_container", (group.open && group.open.exceptions) ? group.open.exceptions.join(",") : "");
  player.sendForm(fm, (player, data) => {
      if (data === null) return;
      let newGroupName = data[0].trim();
      let allowBreak = data[1];
      let allowPlace = data[2];
      let allowRename = data[3];
      let allowManage = data[4];
      let allowManageRules = data[5];
      let allowAttack = data[6]; // 新增：攻击实体权限
      let allowChest = data[7];
      let allowShulker = data[8];
      let allowHopper = data[9];
      let allowEnderChest = data[10];
      let allowDispenser = data[11];
      let allowDropper = data[12];
      let allowFurnace = data[13];
      let allowBlastFurnace = data[14];
      let allowContainer = data[15];
      let allowGrindstone = data[16];
      let allowAnvil = data[17];
      let allowBarrel = data[18];
      let allowCrafter = data[19];
      let allowTrappedChest = data[20];
      let allowCrafting = data[21];
      let allowEnchanting = data[22];
      let allowCartography = data[23];
      let allowSmoker = data[24];
      let allowSmithing = data[25];  
      let allowBeacon = data[26];
      let allowStonecutter = data[27];
      let allowBrewingStand = data[28];
      let allowTakeItem     = data[29]; // 新增：允许捡起物品
      let allowDropItem     = data[30]; // 新增：允许丢出物品
      let allowBedenter       = data[31];
      let allowInteractEntity = data[32];
      let allowInteractBlock  = data[33];
      let allowRide           = data[34];
      let allowArmorstand     = data[35];
      let allowAssign       = data[36];
      let allowUseFrame     = data[37];
      let exceptionsStr     = data[38].trim();
      let exceptionsList = exceptionsStr.length > 0 ? exceptionsStr.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];
      if (newGroupName !== "" && newGroupName !== groupName) {
          if (permGroupsData[newGroupName]) {
              player.tell("该权限组名称已存在，重命名失败。");
              return;
          }
          // 重命名时保留原 owners 信息
          permGroupsData[newGroupName] = { 
            break: allowBreak, 
            place: allowPlace, 
            allowRename: allowRename,
            manage: allowManage,
            manageRules: allowManageRules,
            attack: allowAttack,
            takeitem: allowTakeItem,      // 更新捡起物品配置
            dropitem: allowDropItem,      // 更新丢出物品配置
            bedenter: allowBedenter,
            interactentity: allowInteractEntity,
            interactblock: allowInteractBlock,
            ride: allowRide,
            armorstand: allowArmorstand,
            open: { 
              chest: allowChest, 
              shulker: allowShulker,
              hopper: allowHopper,
              enderchest: allowEnderChest,
              dispenser: allowDispenser,
              dropper: allowDropper,
              furnace: allowFurnace,
              blastfurnace: allowBlastFurnace,
              container: allowContainer,
              grindstone: allowGrindstone,
              anvil: allowAnvil,
              barrel: allowBarrel,
              crafter: allowCrafter,
              trappedchest: allowTrappedChest,
              crafting: allowCrafting,
              enchanting: allowEnchanting,
              cartography: allowCartography,
              smoker: allowSmoker,
              smithing: allowSmithing,
              beacon: allowBeacon,
              stonecutter: allowStonecutter,
              brewingstand: allowBrewingStand,
              exceptions: exceptionsList
          },
          allowAssignByManagers: allowAssign,
          useframe: allowUseFrame,  
            owners: group.owners 
        };
          delete permGroupsData[groupName];
          player.tell(`权限组已重命名为：${newGroupName}，设置已更新。`);
      } else {
          permGroupsData[groupName].break = allowBreak;
          permGroupsData[groupName].place = allowPlace;
          permGroupsData[groupName].allowRename = allowRename;
          permGroupsData[groupName].manage = allowManage;
          permGroupsData[groupName].manageRules = allowManageRules;
          permGroupsData[groupName].attack = allowAttack;
          permGroupsData[groupName].takeitem    = allowTakeItem;
          permGroupsData[groupName].dropitem    = allowDropItem;
          permGroupsData[groupName].bedenter = allowBedenter;
          permGroupsData[groupName].interactentity = allowInteractEntity;
          permGroupsData[groupName].interactblock = allowInteractBlock;
          permGroupsData[groupName].ride = allowRide;
          permGroupsData[groupName].armorstand = allowArmorstand;
          permGroupsData[groupName].open = { 
            chest: allowChest, 
            shulker: allowShulker,
            hopper: allowHopper,
            enderchest: allowEnderChest,
            dispenser: allowDispenser,
            dropper: allowDropper,
            furnace: allowFurnace,
            blastfurnace: allowBlastFurnace,
            container: allowContainer,
            grindstone: allowGrindstone,
            anvil: allowAnvil,
            barrel: allowBarrel,
            crafter: allowCrafter,
            trappedchest: allowTrappedChest,
            crafting: allowCrafting,
            enchanting: allowEnchanting,
            cartography: allowCartography,
            smoker: allowSmoker,
            smithing: allowSmithing,
            beacon: allowBeacon,
            stonecutter: allowStonecutter,
            brewingstand: allowBrewingStand,
            exceptions: exceptionsList
          };
          permGroupsData[groupName].allowAssignByManagers = allowAssign; // 更新新字段
          permGroupsData[groupName].useframe = allowUseFrame;
          player.tell(`权限组 ${groupName} 设置已更新。`);
      }
      savePermGroupsData();
  });
}
/* ===============================
 【新增】添加权限组
=============================== */
function showAddPermGroupForm(player) {
  let fm = mc.newCustomForm();
  fm.setTitle("添加权限组");
  fm.addInput("权限组名称", "例如：vip", "");
  fm.addSwitch("允许破坏方块", false);
  fm.addSwitch("允许放置方块", false);
  fm.addSwitch("允许修改区域名称", false);
  fm.addSwitch("允许管理区域", false); // 新增管理区域开关
  fm.addSwitch("允许管理区域规则", false);
  fm.addSwitch("允许攻击实体", false);
  fm.addSwitch("允许打开箱子", false);
  fm.addSwitch("允许打开潜影盒", false);
  fm.addSwitch("允许打开漏斗", false);
  fm.addSwitch("允许打开末影箱", false);
  fm.addSwitch("允许打开发射器", false);
  fm.addSwitch("允许打开投掷器", false);
  fm.addSwitch("允许打开熔炉", false);
  fm.addSwitch("允许打开高炉", false);
  fm.addSwitch("允许打开其他容器", false);
  fm.addSwitch("允许打开砂轮", false);
  fm.addSwitch("允许打开铁砧", false);
  fm.addSwitch("允许打开木桶", false);
  fm.addSwitch("允许打开合成器", false);
  fm.addSwitch("允许打开陷阱箱", false);
  fm.addSwitch("允许打开工作台", false);
  fm.addSwitch("允许打开附魔台", false);
  fm.addSwitch("允许打开制图台", false);
  fm.addSwitch("允许打开锻造台", false);    
  fm.addSwitch("允许打开烟熏炉", false);
  fm.addSwitch("允许打开信标", false);
  fm.addSwitch("允许打开切石机", false);
  fm.addSwitch("允许打开酿造台", false);
  fm.addSwitch("允许捡起物品", false);
  fm.addSwitch("允许丢出物品", false);
  fm.addSwitch("允许使用床", false);
  fm.addSwitch("允许交互实体", false);
  fm.addSwitch("允许与方块交互", false);
  fm.addSwitch("允许骑乘实体", false);
  fm.addSwitch("允许操控盔甲架", false);
  fm.addSwitch("允许此权限组让其他区域管理员赋权", true);
  fm.addSwitch("允许操作物品展示框", false);  
  fm.addInput("容器例外（多个以逗号隔开）", "例如：mod:custom_container,mod:another_container", "");

  player.sendForm(fm, (player, data) => {
      if (data === null) return;
      let groupName = data[0].trim();
      if (groupName === "") {
          player.tell("权限组名称不能为空！");
          return;
      }
      if (permGroupsData[groupName]) {
          player.tell("该权限组已存在！");
          return;
      }
      let exceptionsStr = data[38].trim();
      let exceptionsList = exceptionsStr.length > 0 ? exceptionsStr.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];
      // 创建自定义权限组，包括新的 allowAssignByManagers 配置
      permGroupsData[groupName] = { 
        break: data[1], 
        place: data[2], 
        allowRename: data[3],
        manage: data[4],
        manageRules: data[5],
        allowAttack: data[6],
        open: { 
            chest: data[7],        // 箱子
            shulker: data[8],       // 潜影盒
            hopper: data[9],        // 漏斗
            enderchest: data[10],    // 末影箱
            dispenser: data[11],     // 发射器
            dropper: data[12],      // 投掷器
            furnace: data[13],      // 熔炉
            blastfurnace: data[14], // 高炉
            container: data[15],     // 其他容器
            grindstone: data[16],      // 砂轮
            anvil: data[17],           // 铁砧（包括 anvil、chipped_anvil、damaged_anvil）
            barrel: data[18],          // 木桶
            crafter: data[19],         // 合成器
            trappedchest: data[20],    // 陷阱箱
            crafting: data[21],        // 工作台
            enchanting: data[22],      // 附魔台
            cartography: data[23],     // 制图台
            smoker: data[24],          // 烟熏炉
            smithing: data[25],             // 【新增】锻造台权限设置
            beacon: data[26],
            stonecutter: data[27],
            brewingstand: data[28],     // 酿造台
            exceptions: exceptionsList
        },
        takeitem: data[29],
        dropitem: data[30],
        bedenter: data[31],
        interactentity: data[32],
        interactblock: data[33],
        ride: data[34],
        armorstand: data[35],
        allowAssignByManagers: data[36],
        useframe: data[37],
        owners: [player.uuid]
    };
    savePermGroupsData();
    player.tell(`权限组 ${groupName} 添加成功！`);
});
}

/* ===============================
 【新增】删除权限组
=============================== */
function showDeletePermGroupForm(player) {
  let groups = [];
  for (let key in permGroupsData) {
    // 仅显示非默认权限组且必须为玩家自己创建的
    if (!defaultPermGroups.includes(key) &&
        (permGroupsData[key].owners && permGroupsData[key].owners.includes(player.uuid))) {
      groups.push(key);
    }
  }
  if (groups.length === 0) {
    player.tell("暂无权限组可供删除。");
    return;
  }
  let fm = mc.newCustomForm();
  fm.setTitle("删除权限组");
  fm.addDropdown("请选择要删除的权限组", groups, 0);
  fm.addInput("请在下方输入 'delete' 以确认删除", "", "");
  player.sendForm(fm, (player, data) => {
    if (data === null) return;
    let selectedGroup = groups[data[0]];
    let confirmText = data[1].trim();
    if (confirmText !== "delete") {
      player.tell("删除操作未确认，已取消。");
      return;
    }
    delete permGroupsData[selectedGroup];
    savePermGroupsData();
    player.tell(`权限组 ${selectedGroup} 已删除。`);
  });
}

/**
 * 显示设 置玩家权限组的表单：批量设置区域成员的权限组
 * 此表单显示所有玩家（包括离线玩家），支持搜索和分页，用户可以批量选择玩家然后设置其权限组。
 * @param {Player} player 当前操作的玩家（区域所有者）
 * @param {string} areaId 区域ID
 * @param {number} [currentPage=0] 当前页码（从0开始），默认为0
 * @param {string} [filter=""] 搜索关键词，默认为空字符串
 */
function showPlayerSelectionFormForMemberGroup(player, areaId, currentPage, filter) {
    // 初始化参数
    if (typeof currentPage === "undefined") currentPage = 0;
    if (typeof filter === "undefined") filter = "";
  
    // 获取所有玩家信息（包括离线玩家）
    let allPlayers = getAllPlayersInfo();
    
    // 根据搜索关键词（玩家昵称）进行过滤
    let filteredPlayers = allPlayers;
    if (filter.trim() !== "") {
      filteredPlayers = allPlayers.filter(p => (p.name || "").includes(filter));
    }
  
    // 分页设置：每页显示的玩家数量
    let pageSize = 5;
    let totalPages = Math.ceil(filteredPlayers.length / pageSize);
    if (totalPages < 1) totalPages = 1;
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    let startIndex = currentPage * pageSize;
    let endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
    let pagePlayers = filteredPlayers.slice(startIndex, endIndex);
  
    // 构建自定义表单
    let fm = mc.newCustomForm();
    fm.setTitle("批量设置区域成员权限组");
  
    // 1. 搜索输入框（索引 0）
    fm.addInput("搜索玩家", "请输入玩家昵称", filter);
  
    // 2. 为当前页内的每个玩家增加一个开关控件供选择（索引从 1 开始）
    for (let i = 0; i < pagePlayers.length; i++) {
      let p = pagePlayers[i];
      fm.addSwitch(`玩家：${p.name} (UUID: ${p.uuid})`, false);
    }
    
    // 3. 增加“完成选择”开关，用户通过该项提交设置（索引：1+pagePlayers.length）
    fm.addSwitch("完成选择", false);
    
    // 4. 分页滑块：构建页码选择（索引：1+pagePlayers.length+1）
    let sliderItems = [];
    for (let i = 0; i < totalPages; i++) {
      sliderItems.push("第" + (i + 1) + "页");
    }
    fm.addStepSlider("选择页码", sliderItems, currentPage);
  
    // 5. 下拉菜单：选择目标权限组（索引：1+pagePlayers.length+2）
    let area = areaData[areaId];
    let isOwner = (area.ownerxuid === player.xuid || area.ownerUuid === player.uuid);
    let ownerUuid = area.ownerUuid;
    
    let groups = [];
    for (let key in permGroupsData) {
      // 默认权限组始终允许
      if (defaultPermGroups.includes(key)) {
        groups.push(key);
    } else if (permGroupsData[key].owners && Array.isArray(permGroupsData[key].owners)) {
        if (isOwner) {
            // 操作玩家为区域所有者，允许显示自己创建的权限组
            if (permGroupsData[key].owners.includes(player.uuid)) {
                groups.push(key);
            }
        } else {
            // 操作玩家为区域管理员，允许显示区域所有者所创建的权限组
            if (permGroupsData[key].owners.includes(ownerUuid)) {
                groups.push(key);
            }
        }
      }
    }
    fm.addDropdown("选择目标权限组", groups, 0);
  
    // 发送表单
    player.sendForm(fm, (player, data) => {
      if (data === null) return; // 玩家取消了表单
  
      // data 数组各项含义：
      // data[0]                         => 搜索输入框文本
      // data[1] ~ data[1 + count - 1]     => 当前页每个玩家的开关状态
      // data[1 + count]                 => “完成选择”开关状态
      // data[1 + count + 1]             => 分页滑块返回的页码（数值，从0开始）
      // data[1 + count + 2]             => 下拉菜单返回的权限组索引
  
      let newFilter = data[0].trim();
      let selectedPlayers = [];
      for (let i = 0; i < pagePlayers.length; i++) {
        if (data[1 + i] === true) {
          selectedPlayers.push(pagePlayers[i].uuid);
        }
      }
      let completeSwitch = data[1 + pagePlayers.length];
      let chosenPage = data[1 + pagePlayers.length + 1];
      let groupIndex = data[1 + pagePlayers.length + 2];

      // 新增防御性检查：若下拉菜单未返回有效值，则默认为 0
    if (groupIndex === undefined || groupIndex < 0 || groupIndex >= groups.length) {
    groupIndex = 0;
      }
  
      // 如果搜索关键词发生改变，则刷新表单（重置分页为0）
      if (newFilter !== filter) {
        showPlayerSelectionFormForMemberGroup(player, areaId, 0, newFilter);
        return;
      }
      
      // 如果玩家通过滑块切换了页码，则刷新表单显示对应页
      if (chosenPage !== currentPage) {
        showPlayerSelectionFormForMemberGroup(player, areaId, chosenPage, filter);
        return;
      }
      
      // 当开启“完成选择”且至少选择了一个玩家，进行批量设置
      if (completeSwitch) {
        if (selectedPlayers.length > 0) {
          // 确保当前区域的权限数据存在，并初始化 memberGroups 子项
          if (!permissionsData[areaId]) {
            permissionsData[areaId] = {};
          }
          if (!permissionsData[areaId].memberGroups) {
            permissionsData[areaId].memberGroups = {};
          }
          let chosenGroup = groups[groupIndex];
          // 批量为每个选中的玩家设置权限组
          for (let uuid of selectedPlayers) {
            permissionsData[areaId].memberGroups[uuid] = chosenGroup;
          }
          savePermissionsData();
          player.tell(`已为所选玩家批量设置权限组为：${chosenGroup}`);
        } else {
          player.tell("未选择任何玩家！");
          // 重新显示当前表单
          showPlayerSelectionFormForMemberGroup(player, areaId, currentPage, filter);
        }
      } else {
        player.tell("调试信息：表单提交，但未触发完成选择。");
      }
    });
  }

// 新增函数：检查在线玩家是否位于任意区域内，并显示提示信息
function checkPlayerAreas() {
  let players = mc.getOnlinePlayers();
  players.forEach(player => {
    let pos = player.pos;
    let inArea = false;
    for (let areaId in areaData) {
      let area = areaData[areaId];
      if (isPosInArea(pos, area)) {
        // 使用 pl.tell(msg, type) 在物品栏上方显示提示信息（这里使用 "tip" 类型）
        player.tell(`§b当前区域：${area.nickname}`, 5);
        inArea = true;
        break; // 找到第一个匹配区域后退出循环
      }
    }
    // 没有处于任何区域内时，可选择不显示或清空提示信息
    if (!inArea) {
    }
  });
}

// 注册定时任务，每秒执行一次区域检测
setInterval(checkPlayerAreas, 1000);

// 修改后的 reselectAreaRange 函数：使用原来的 isAreaOverlap 检查新范围
function reselectAreaRange(player, areaId) {
  let temp = playerTempPoints[player.uuid];
  if (!temp || !temp.pos1 || !temp.pos2) {
      player.tell("请先使用 /area pos1 和 /area pos2 命令设置新的范围！");
      return;
  }
  if (temp.dimid1 !== temp.dimid2) {
      player.tell("错误：两个点必须在同一维度！");
      return;
  }

  let newArea = {
      pos1: temp.pos1,
      pos2: temp.pos2
  };

  // 为避免当前区域自身干扰，将当前区域先暂时移除
  let backupArea = areaData[areaId];
  delete areaData[areaId];

  // 使用原来的 isAreaOverlap 函数判断新范围是否与其他区域重叠
  if (isAreaOverlap(newArea)) {
      // 恢复当前区域数据
      areaData[areaId] = backupArea;
      player.tell("新范围与其他区域重叠，更新失败！");
      return;
  }
  // 恢复当前区域数据
  areaData[areaId] = backupArea;

  let size = {
      x: Math.abs(temp.pos2.x - temp.pos1.x) + 1,
      y: Math.abs(temp.pos2.y - temp.pos1.y) + 1,
      z: Math.abs(temp.pos2.z - temp.pos1.z) + 1
  };

  // 使用和创建区域时类似的自定义表单确认新的范围
  let fm = mc.newCustomForm();
  fm.setTitle("确认更新区域范围");
  fm.addLabel(`新起点坐标: ${temp.pos1.x}, ${temp.pos1.y}, ${temp.pos1.z}`);
  fm.addLabel(`新终点坐标: ${temp.pos2.x}, ${temp.pos2.y}, ${temp.pos2.z}`);
  fm.addLabel(`区域大小: ${size.x}x${size.y}x${size.z}`);
  fm.addLabel("确认更新区域范围吗？");

  player.sendForm(fm, (player, data) => {
      if (data === null) {
          player.tell("已取消更新区域范围！");
          return;
      }
      // 更新区域数据
      areaData[areaId].pos1 = temp.pos1;
      areaData[areaId].pos2 = temp.pos2;
      areaData[areaId].size = size;
      saveAreaData();
      player.tell("区域范围更新成功！");
      // 清除玩家的临时数据
      delete playerTempPoints[player.uuid];
  });
}

/* ===============================
   新增：转让区域所有权功能
   仅允许区域所有者执行转让
   转让的选择表单类似于设置玩家权限组的表单，但只允许选择一个目标玩家
=============================== */
function showAreaTransferOwnershipForm(player, areaId, currentPage, filter) {
  if (typeof currentPage === "undefined") currentPage = 0;
  if (typeof filter === "undefined") filter = "";
  
  // 获取所有玩家信息，并过滤掉当前所有者
  let allPlayers = getAllPlayersInfo();
  let filteredPlayers = allPlayers.filter(p => p.uuid !== player.uuid);
  if (filter.trim() !== "") {
      filteredPlayers = filteredPlayers.filter(p => (p.name || "").includes(filter));
  }
  
  // 分页设置，每页显示最多 5 个玩家
  let pageSize = 5;
  let totalPages = Math.ceil(filteredPlayers.length / pageSize);
  if (totalPages < 1) totalPages = 1;
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  
  let startIndex = currentPage * pageSize;
  let endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
  let pagePlayers = filteredPlayers.slice(startIndex, endIndex);
  
  let fm = mc.newCustomForm();
  fm.setTitle("转让区域所有权");
  
  // ① 搜索输入框（用于过滤玩家）
  fm.addInput("搜索玩家", "请输入玩家昵称", filter);
  
  // ② 为当前页每个玩家添加开关选择（多个开关，但用户只允许选择一人）
  for (let i = 0; i < pagePlayers.length; i++) {
      fm.addSwitch(`玩家：${pagePlayers[i].name} (UUID: ${pagePlayers[i].uuid})`, false);
  }
  
  // ③ 添加“完成选择”开关
  fm.addSwitch("完成选择", false);
  
  // ④ 添加分页滑块（提示：第X页）
  let sliderItems = [];
  for (let i = 0; i < totalPages; i++) {
      sliderItems.push("第" + (i + 1) + "页");
  }
  fm.addStepSlider("选择页码", sliderItems, currentPage);
  
  // 处理表单返回数据
  player.sendForm(fm, (player, data) => {
      if (data === null) return;
      
      let searchKeyword = data[0].trim();
      
      // 统计当前页选中的玩家数量及记录选中的第一个索引
      let selectedCount = 0;
      let selectedIndex = -1;
      for (let i = 0; i < pagePlayers.length; i++) {
          if (data[1 + i] === true) {
              selectedCount++;
              selectedIndex = i;
          }
      }
      
      let completeSwitch = data[1 + pagePlayers.length];
      let chosenPage = data[1 + pagePlayers.length + 1];
      
      // 如果搜索关键词发生变化，则刷新表单（将页码重置为 0）
      if (searchKeyword !== filter) {
          showAreaTransferOwnershipForm(player, areaId, 0, searchKeyword);
          return;
      }
      // 如果滑块页码改变，则刷新表单
      if (chosenPage !== currentPage) {
          showAreaTransferOwnershipForm(player, areaId, chosenPage, filter);
          return;
      }
      
      if (!completeSwitch) {
          player.tell("你未确认转让操作，已取消转让。");
          return;
      }
      
      // 只允许选择一名玩家
      if (selectedCount !== 1) {
          player.tell("请只选择一名玩家来转让区域所有权！");
          showAreaTransferOwnershipForm(player, areaId, currentPage, filter);
          return;
      }
      
      // 获取目标玩家信息
      let targetPlayer = pagePlayers[selectedIndex];
      if (!targetPlayer) {
          player.tell("未能找到选定的玩家，请重试。");
          return;
      }
      
      // 检查区域是否存在
      let area = areaData[areaId];
      if (!area) {
          player.tell("区域不存在！");
          return;
      }
      
      // 仅允许区域所有者转让
      if (area.ownerUuid !== player.uuid) {
          player.tell("你不是该区域的所有者，无法转让所有权！");
          return;
      }
      
      // 更新区域所有者信息（注意：这里假设 targetPlayer 对象中包含 xuid 字段）
      area.ownerxuid = targetPlayer.xuid;
      area.ownerUuid = targetPlayer.uuid;
      saveAreaData();
      player.tell(`区域所有权已成功转让给玩家：${targetPlayer.name} (UUID: ${targetPlayer.uuid})`);
  });
}

// 生成唯一ID的函数
function generateUniqueId() {
    return 'area_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 初始化加载
loadAreaData();

