// settingsForm.js
const { getPlayerSettings, updatePlayerSettings } = require('./playerSettings');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
function showSettingsForm(pl) {
    const settings = getPlayerSettings(pl.uuid);
    
    let fm = mc.newCustomForm();
    fm.setTitle("区域显示设置");
    fm.addSwitch("显示顶部ActionBar", settings.displayActionBar);
    fm.addSwitch("显示中间标题提示", settings.displayTitle);
    fm.addSlider("显示冷却时间(秒)", 1, 10, 1, settings.displayCooldown / 1000);
    
    pl.sendForm(fm, (pl, data) => {
        if (data === null) return;
        
        const newSettings = {
            displayActionBar: data[0],
            displayTitle: data[1],
            displayCooldown: data[2] * 1000  // 转换为毫秒
        };
        
        if (updatePlayerSettings(pl.uuid, newSettings)) {
            pl.sendText("§a设置已保存！");
        } else {
            pl.sendText("§c设置保存失败！");
        }
    });
}

module.exports = {
    showSettingsForm
};