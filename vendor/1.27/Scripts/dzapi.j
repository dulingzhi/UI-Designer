globals
//===================================================
// DzAPI API constants
//===================================================
    constant unitstate            UNITTYPE_DATATYPE_BLDTM                             = ConvertUnitState(65560) // 状态-建造时间
    constant unitstate            UNITTYPE_DATATYPE_REPTM                             = ConvertUnitState(65564) // 状态-修理时间
    constant unitstate            UNITTYPE_DATATYPE_GOLDCOST                          = ConvertUnitState(65568) // 状态-黄金消耗
    constant unitstate            UNITTYPE_DATATYPE_LUMBERCOST                        = ConvertUnitState(65572) // 状态-木材消耗
    constant unitstate            UNITTYPE_DATATYPE_GOLDREP                           = ConvertUnitState(65576) // 状态-修理黄金消耗
    constant unitstate            UNITTYPE_DATATYPE_LUMBERREP                         = ConvertUnitState(65580) // 状态-修理木材消耗
    constant unitstate            UNITTYPE_DATATYPE_BOUNTYDICE                        = ConvertUnitState(65584) // 状态-黄金奖励-骰子数量
    constant unitstate            UNITTYPE_DATATYPE_BOUNTYSIDES                       = ConvertUnitState(65588) // 状态-黄金奖励-骰子面数
    constant unitstate            UNITTYPE_DATATYPE_BOUNTYPLUS                        = ConvertUnitState(65592) // 状态-黄金奖励-基础值
    constant unitstate            UNITTYPE_DATATYPE_LUMBERBOUNTYDICE                  = ConvertUnitState(65596) // 状态-木材奖励-骰子数量
    constant unitstate            UNITTYPE_DATATYPE_LUMBERBOUNTYSIDES                 = ConvertUnitState(65600) // 状态-木材奖励-骰子面数
    constant unitstate            UNITTYPE_DATATYPE_LUMBERBOUNTYPLUS                  = ConvertUnitState(65604) // 状态-木材奖励-基础值
    constant unitstate            UNITTYPE_DATATYPE_STOCKMAX                          = ConvertUnitState(65608) // 状态-最大库存量
    constant unitstate            UNITTYPE_DATATYPE_STOCKREGEN                        = ConvertUnitState(65612) // 状态-雇佣时间间隔
    constant unitstate            UNITTYPE_DATATYPE_STOCKSTART                        = ConvertUnitState(65616) // 状态-雇佣开始时间
    constant unitstate            UNITTYPE_DATATYPE_CANSLEEP                          = ConvertUnitState(65620) // 状态-允许睡眠
    constant unitstate            UNITTYPE_DATATYPE_CANFLEE                           = ConvertUnitState(65624) // 状态-可以逃跑
    constant unitstate            UNITTYPE_DATATYPE_FUSED                             = ConvertUnitState(65628) // 状态-占用人口
    constant unitstate            UNITTYPE_DATATYPE_FMADE                             = ConvertUnitState(65632) // 状态-提供人口
    constant unitstate            UNITTYPE_DATATYPE_CARGOSIZE                         = ConvertUnitState(65636) // 状态-运输尺寸
    constant unitstate            UNITTYPE_DATATYPE_LEVEL                             = ConvertUnitState(65640) // 状态-等级
    constant unitstate            UNITTYPE_DATATYPE_CASTPT                            = ConvertUnitState(65644) // 显示-动画-魔法施放点
    constant unitstate            UNITTYPE_DATATYPE_CASBSW                            = ConvertUnitState(65648) // 显示-动画-魔法施放回复
    constant unitstate            UNITTYPE_DATATYPE_DEATH                             = ConvertUnitState(65652) // 显示-死亡时间（秒）
    constant unitstate            UNITTYPE_DATATYPE_REGENHP                           = ConvertUnitState(65660) // 状态-生命恢复
    constant unitstate            UNITTYPE_DATATYPE_HP                                = ConvertUnitState(65664) // 状态-生命最大值
    constant unitstate            UNITTYPE_DATATYPE_MANA0                             = ConvertUnitState(65668) // 状态-魔法初始数量
    constant unitstate            UNITTYPE_DATATYPE_MANAN                             = ConvertUnitState(65672) // 状态-魔法最大值
    constant unitstate            UNITTYPE_DATATYPE_REGENMANA                         = ConvertUnitState(65676) // 状态-魔法回复
    constant unitstate            UNITTYPE_DATATYPE_DEF                               = ConvertUnitState(65680) // 战斗-基础防御
    constant unitstate            UNITTYPE_DATATYPE_DEFUP                             = ConvertUnitState(65684) // 战斗-防御升级奖励
    constant unitstate            UNITTYPE_DATATYPE_TARGS1                            = ConvertUnitState(65696) // 战斗-攻击1-目标允许
    constant unitstate            UNITTYPE_DATATYPE_TARGS2                            = ConvertUnitState(65700) // 战斗-攻击2-目标允许
    constant unitstate            UNITTYPE_DATATYPE_DMGUP1                            = ConvertUnitState(65704) // 战斗-攻击1-伤害升级奖励
    constant unitstate            UNITTYPE_DATATYPE_DMGUP2                            = ConvertUnitState(65708) // 战斗-攻击2-伤害升级奖励
    constant unitstate            UNITTYPE_DATATYPE_DICE1                             = ConvertUnitState(65712) // 战斗-攻击1-伤害骰子数量
    constant unitstate            UNITTYPE_DATATYPE_DICE2                             = ConvertUnitState(65716) // 战斗-攻击2-伤害骰子数量
    constant unitstate            UNITTYPE_DATATYPE_SIDES1                            = ConvertUnitState(65720) // 战斗-攻击1-伤害骰子面数
    constant unitstate            UNITTYPE_DATATYPE_SIDES2                            = ConvertUnitState(65724) // 战斗-攻击2-伤害骰子面数
    constant unitstate            UNITTYPE_DATATYPE_DMGPLUS1                          = ConvertUnitState(65728) // 战斗-攻击1-基础伤害
    constant unitstate            UNITTYPE_DATATYPE_DMGPLUS2                          = ConvertUnitState(65732) // 战斗-攻击2-基础伤害
    constant unitstate            UNITTYPE_DATATYPE_TARGCOUNT1                        = ConvertUnitState(65736) // 战斗-攻击1-最大目标数
    constant unitstate            UNITTYPE_DATATYPE_TARGCOUNT2                        = ConvertUnitState(65740) // 战斗-攻击2-最大目标数
    constant unitstate            UNITTYPE_DATATYPE_DAMAGELOSS1                       = ConvertUnitState(65744) // 战斗-攻击1-伤害衰减参数
    constant unitstate            UNITTYPE_DATATYPE_DAMAGELOSS2                       = ConvertUnitState(65748) // 战斗-攻击2-伤害衰减参数
    constant unitstate            UNITTYPE_DATATYPE_SPILLRADIUS1                      = ConvertUnitState(65752) // 战斗-攻击1-穿透伤害距离
    constant unitstate            UNITTYPE_DATATYPE_SPILLRADIUS2                      = ConvertUnitState(65756) // 战斗-攻击2-穿透伤害距离
    constant unitstate            UNITTYPE_DATATYPE_SPILLDIST1                        = ConvertUnitState(65760) // 战斗-攻击1-穿透伤害范围
    constant unitstate            UNITTYPE_DATATYPE_SPILLDIST2                        = ConvertUnitState(65764) // 战斗-攻击2-穿透伤害范围
    constant unitstate            UNITTYPE_DATATYPE_RANGEN1                           = ConvertUnitState(65792) // 战斗-攻击1-攻击范围
    constant unitstate            UNITTYPE_DATATYPE_RANGEN2                           = ConvertUnitState(65796) // 战斗-攻击2-攻击范围
    constant unitstate            UNITTYPE_DATATYPE_RNGBUFF1                          = ConvertUnitState(65800) // 战斗-攻击1-攻击范围缓冲
    constant unitstate            UNITTYPE_DATATYPE_RNGBUFF2                          = ConvertUnitState(65804) // 战斗-攻击2-攻击范围缓冲
    constant unitstate            UNITTYPE_DATATYPE_COOL1                             = ConvertUnitState(65808) // 战斗-攻击1-攻击间隔
    constant unitstate            UNITTYPE_DATATYPE_COOL2                             = ConvertUnitState(65812) // 战斗-攻击2-攻击间隔
    constant unitstate            UNITTYPE_DATATYPE_DMGPT1                            = ConvertUnitState(65816) // 战斗-攻击1-动画伤害点
    constant unitstate            UNITTYPE_DATATYPE_DMGPT2                            = ConvertUnitState(65820) // 战斗-攻击2-动画伤害点
    constant unitstate            UNITTYPE_DATATYPE_BACKSW1                           = ConvertUnitState(65824) // 战斗-攻击1-动画回复点
    constant unitstate            UNITTYPE_DATATYPE_BACKSW2                           = ConvertUnitState(65828) // 战斗-攻击2-动画回复点
    constant unitstate            UNITTYPE_DATATYPE_SPLASHTARGS1                      = ConvertUnitState(65832) // 战斗-攻击1-范围影响目标
    constant unitstate            UNITTYPE_DATATYPE_SPLASHTARGS2                      = ConvertUnitState(65836) // 战斗-攻击2-范围影响目标
    constant unitstate            UNITTYPE_DATATYPE_FAREA1                            = ConvertUnitState(65840) // 战斗-攻击1-全伤害范围
    constant unitstate            UNITTYPE_DATATYPE_FAREA2                            = ConvertUnitState(65844) // 战斗-攻击2-全伤害范围
    constant unitstate            UNITTYPE_DATATYPE_HAREA1                            = ConvertUnitState(65848) // 战斗-攻击1-中伤害范围
    constant unitstate            UNITTYPE_DATATYPE_HAREA2                            = ConvertUnitState(65852) // 战斗-攻击2-中伤害范围
    constant unitstate            UNITTYPE_DATATYPE_QAREA1                            = ConvertUnitState(65856) // 战斗-攻击1-小伤害范围
    constant unitstate            UNITTYPE_DATATYPE_QAREA2                            = ConvertUnitState(65860) // 战斗-攻击2-小伤害范围
    constant unitstate            UNITTYPE_DATATYPE_HFACT1                            = ConvertUnitState(65864) // 战斗-攻击1-中伤害参数
    constant unitstate            UNITTYPE_DATATYPE_HFACT2                            = ConvertUnitState(65868) // 战斗-攻击2-中伤害参数
    constant unitstate            UNITTYPE_DATATYPE_QFACT1                            = ConvertUnitState(65872) // 战斗-攻击1-小伤害参数
    constant unitstate            UNITTYPE_DATATYPE_QFACT2                            = ConvertUnitState(65876) // 战斗-攻击2-小伤害参数
    constant unitstate            UNITTYPE_DATATYPE_SHOWUI1                           = ConvertUnitState(65896) // 战斗-攻击1-显示UI
    constant unitstate            UNITTYPE_DATATYPE_SHOWUI2                           = ConvertUnitState(65900) // 战斗-攻击2-显示UI
    constant unitstate            UNITTYPE_DATATYPE_STR                               = ConvertUnitState(65904) // 状态-英雄-初始力量
    constant unitstate            UNITTYPE_DATATYPE_AGI                               = ConvertUnitState(65908) // 状态-英雄-初始敏捷
    constant unitstate            UNITTYPE_DATATYPE_INT                               = ConvertUnitState(65912) // 状态-英雄-初始智力
    constant unitstate            UNITTYPE_DATATYPE_STRPLUS                           = ConvertUnitState(65920) // 英雄-每等级提升力量
    constant unitstate            UNITTYPE_DATATYPE_AGIPLUS                           = ConvertUnitState(65924) // 英雄-每等级提升敏捷
    constant unitstate            UNITTYPE_DATATYPE_INTPLUS                           = ConvertUnitState(65928) // 英雄-每等级提升智力
    constant unitstate            UNITTYPE_DATATYPE_SIGHT                             = ConvertUnitState(65932) // 状态-视野范围（白天）
    constant unitstate            UNITTYPE_DATATYPE_NSIGHT                            = ConvertUnitState(65936) // 状态-视野范围（夜晚）
    constant unitstate            UNITTYPE_DATATYPE_ACQUIRE                           = ConvertUnitState(65940) // 战斗-主动攻击范围
    constant unitstate            UNITTYPE_DATATYPE_MINRANGE                          = ConvertUnitState(65944) // 战斗-最小攻击范围
    constant unitstate            UNITTYPE_DATATYPE_COLLISION                         = ConvertUnitState(65948) // 路径-碰撞体积
    constant unitstate            UNITTYPE_DATATYPE_FOGRAD                            = ConvertUnitState(65952) // 显示-战争迷雾-采样范围
    constant unitstate            UNITTYPE_DATATYPE_SCALEBULL                         = ConvertUnitState(65956) // 显示-缩放投射物
    constant unitstate            UNITTYPE_DATATYPE_TARGTYPE                          = ConvertUnitState(65972) // 战斗-作为目标类型
    constant unitstate            UNITTYPE_DATATYPE_BUFFRADIUS                        = ConvertUnitState(65980) // 路径-AI放置范围
    constant unitstate            UNITTYPE_DATATYPE_PRIO                              = ConvertUnitState(65996) // 状态-编队优先权
    constant unitstate            UNITTYPE_DATATYPE_POINTS                            = ConvertUnitState(66000) // 状态-单位附加值
    constant unitstate            UNITTYPE_DATATYPE_SPD                               = ConvertUnitState(66004) // 移动-基础速度
    constant unitstate            UNITTYPE_DATATYPE_MINSPD                            = ConvertUnitState(66008) // 移动-最小速度
    constant unitstate            UNITTYPE_DATATYPE_MAXSPD                            = ConvertUnitState(66012) // 移动-最大速度
    constant unitstate            UNITTYPE_DATATYPE_TURNRATE                          = ConvertUnitState(66016) // 移动-转身速度
    constant unitstate            UNITTYPE_DATATYPE_PROPWIN                           = ConvertUnitState(66020) // 显示-动画-转向角度
    constant unitstate            UNITTYPE_DATATYPE_ORIENTINTERP                      = ConvertUnitState(66024) // 显示-动画-转向补正
    constant unitstate            UNITTYPE_DATATYPE_FORMATION                         = ConvertUnitState(66028) // 状态-队形排列
    constant unitstate            UNITTYPE_DATATYPE_OCCH                              = ConvertUnitState(66032) // 显示-闭塞高度
    constant unitstate            UNITTYPE_DATATYPE_FATLOS                            = ConvertUnitState(66036) // 显示-不可见区域显示单位
    constant unitstate            UNITTYPE_DATATYPE_MOVEHEIGHT                        = ConvertUnitState(66040) // 移动-高度
    constant unitstate            UNITTYPE_DATATYPE_MOVEFLOOR                         = ConvertUnitState(66044) // 移动-最小高度
    constant unitstate            UNITTYPE_DATATYPE_LAUNCHX                           = ConvertUnitState(66048) // 显示-射弹偏移-X
    constant unitstate            UNITTYPE_DATATYPE_LAUNCHY                           = ConvertUnitState(66052) // 显示-射弹偏移-Y
    constant unitstate            UNITTYPE_DATATYPE_LAUNCHZ                           = ConvertUnitState(66056) // 显示-射弹偏移-Z
    constant unitstate            UNITTYPE_DATATYPE_LAUNCHSWIMZ                       = ConvertUnitState(66060) // 显示-射弹偏移-Z(深水)
    constant unitstate            UNITTYPE_DATATYPE_IMPACTZ                           = ConvertUnitState(66064) // 显示-射弹碰撞偏移-Z
    constant unitstate            UNITTYPE_DATATYPE_IMPACTSWIMZ                       = ConvertUnitState(66068) // 显示-射弹碰撞偏移-Z（深水）
    constant unitstate            UNITTYPE_DATATYPE_BLEND                             = ConvertUnitState(66072) // 显示-动画-混合时间（秒）
    constant unitstate            UNITTYPE_DATATYPE_WALK                              = ConvertUnitState(66076) // 显示-动画-行走速度
    constant unitstate            UNITTYPE_DATATYPE_RUN                               = ConvertUnitState(66080) // 显示-动画-跑步速度
    constant unitstate            UNITTYPE_DATATYPE_REPULSE                           = ConvertUnitState(66084) // 移动-组群分离-允许
    constant unitstate            UNITTYPE_DATATYPE_REPULSEPARAM                      = ConvertUnitState(66088) // 移动-组群分离-参数
    constant unitstate            UNITTYPE_DATATYPE_REPULSEGROUP                      = ConvertUnitState(66092) // 移动-组群分离-组号
    constant unitstate            UNITTYPE_DATATYPE_REPULSEPRIO                       = ConvertUnitState(66096) // 移动-组群分离-优先权
    constant unitstate            UNITTYPE_DATATYPE_UPGRADES                          = ConvertUnitState(66108) // 科技树-使用科技
    constant unitstate            UNITTYPE_DATATYPE_ISBUILDON                         = ConvertUnitState(66140) // 状态-能建造在其他建筑上
    constant unitstate            UNITTYPE_DATATYPE_CANBUILDON                        = ConvertUnitState(66144) // 状态-能被其他建筑建造
    constant unitstate            UNITTYPE_DATATYPE_AUTO                              = ConvertUnitState(66160) // 技能-默认主动技能
    constant unitstate            UNITTYPE_DATATYPE_ABILLIST                          = ConvertUnitState(66164) // 技能-普通
    constant unitstate            UNITTYPE_DATATYPE_HEROABILLIST                      = ConvertUnitState(66176) // 技能-英雄
    constant unitstate            UNITTYPE_DATATYPE_ISBLDG                            = ConvertUnitState(66188) // 状态-是一个建筑
    constant unitstate            UNITTYPE_DATATYPE_SPECIAL                           = ConvertUnitState(66192) // 编辑器-分类-特殊
    constant unitstate            UNITTYPE_DATATYPE_HOSTILEPAL                        = ConvertUnitState(66196) // 编辑器-可以作为中立敌对显示
    constant unitstate            UNITTYPE_DATATYPE_NBRANDOM                          = ConvertUnitState(66200) // 状态-中立建筑-可以作为随机建筑
    constant unitstate            UNITTYPE_DATATYPE_REQUIREWATERRADIUS                = ConvertUnitState(66232) // 路径-放置要求距离水的范围
    constant unitstate            UNITTYPE_DATATYPEEXT_NAME                           = ConvertUnitState(131116) // 文本-名字
    constant unitstate            UNITTYPE_DATATYPEEXT_DESCRIPTION                    = ConvertUnitState(131120) // 文本-说明
    constant unitstate            UNITTYPE_DATATYPEEXT_FILE                           = ConvertUnitState(131124) // 显示-模型文件
    constant unitstate            UNITTYPE_DATATYPEEXT_FILEPORTRAIT                   = ConvertUnitState(131128) // 显示-模型文件（头像）
    constant unitstate            UNITTYPE_DATATYPEEXT_MISSILEART                     = ConvertUnitState(131140) // 战斗-攻击-投射物图像
    constant unitstate            UNITTYPE_DATATYPEEXT_UBERSPLAT                      = ConvertUnitState(131144) // 显示-建筑地面纹理
    constant unitstate            UNITTYPE_DATATYPEEXT_SHADOW                         = ConvertUnitState(131148) // 显示-阴影图像（单位）
    constant unitstate            UNITTYPE_DATATYPEEXT_BUILDINGSHADOW                 = ConvertUnitState(131152) // 显示-阴影图像（建筑）
    constant unitstate            UNITTYPE_DATATYPEEXT_SCALE                          = ConvertUnitState(131156) // 显示-选择缩放
    constant unitstate            UNITTYPE_DATATYPEEXT_SELZ                           = ConvertUnitState(131160) // 显示-选择圈高度
    constant unitstate            UNITTYPE_DATATYPEEXT_MISSILESPEED                   = ConvertUnitState(131172) // 战斗-攻击-射弹速率
    constant unitstate            UNITTYPE_DATATYPEEXT_MISSILEARC                     = ConvertUnitState(131184) // 战斗-攻击射弹弧度
    constant unitstate            UNITTYPE_DATATYPEEXT_MISSILEHOMING                  = ConvertUnitState(131196) // 战斗-攻击-射弹自导允许
    constant unitstate            UNITTYPE_DATATYPEEXT_SHADOWX                        = ConvertUnitState(131200) // 显示-阴影图像-X轴偏移
    constant unitstate            UNITTYPE_DATATYPEEXT_SHADOWY                        = ConvertUnitState(131204) // 显示-阴影图像-Y轴偏移
    constant unitstate            UNITTYPE_DATATYPEEXT_SHADOWW                        = ConvertUnitState(131208) // 显示-阴影图像-宽度
    constant unitstate            UNITTYPE_DATATYPEEXT_SHADOWH                        = ConvertUnitState(131212) // 显示-阴影图像-高度
    constant unitstate            UNITTYPE_DATATYPEEXT_SHADOWONWATER                  = ConvertUnitState(131216) // 显示-深水区有阴影
    constant unitstate            UNITTYPE_DATATYPEEXT_SELCIRCONWATER                 = ConvertUnitState(131220) // 显示-选择圈在水面上
    constant unitstate            UNITTYPE_DATATYPEEXT_MAXPITCH                       = ConvertUnitState(131224) // 显示-X轴最大旋转角度（度数）
    constant unitstate            UNITTYPE_DATATYPEEXT_MAXROLL                        = ConvertUnitState(131228) // 显示-Y轴最大旋转角度（度数）
    constant unitstate            UNITTYPE_DATATYPEEXT_ELEVPTS                        = ConvertUnitState(131232) // 显示-高度变化-采样点数量
    constant unitstate            UNITTYPE_DATATYPEEXT_ELEVRAD                        = ConvertUnitState(131236) // 显示-高度变化-采样范围
    constant unitstate            UNITTYPE_DATATYPEEXT_COLOR                          = ConvertUnitState(131244) // 显示-颜色值
    constant unitstate            UNITTYPE_DATATYPEEXT_MODELSCALE                     = ConvertUnitState(131248) // 显示-模型缩放
    constant unitstate            UNITTYPE_DATATYPEEXT_NBMMICON                       = ConvertUnitState(131256) // 状态-中立建筑-显示小地图标记
    constant unitstate            UNITTYPE_DATATYPEEXT_HIDEHEROBAR                    = ConvertUnitState(131260) // 状态-英雄-隐藏英雄栏图标
    constant unitstate            UNITTYPE_DATATYPEEXT_HIDEHEROMINIMAP                = ConvertUnitState(131264) // 状态-英雄-隐藏小地图英雄显示
    constant unitstate            UNITTYPE_DATATYPEEXT_HIDEONMINIMAP                  = ConvertUnitState(131268) // 状态-隐藏小地图显示
    constant unitstate            UNITTYPE_DATATYPEEXT_HIDEHERODEATHMSG               = ConvertUnitState(131272) // 状态-英雄-隐藏英雄死亡信息
    constant unitstate            UNITTYPE_DATATYPEEXT_AWAKENTIP                      = ConvertUnitState(131296) // 文本-提示工具-唤醒
    constant unitstate            UNITTYPE_DATATYPEEXT_REVIVETIP                      = ConvertUnitState(131308) // 文本-提示工具-重生
    constant unitstate            UNITTYPE_DATATYPEEXT_PROERNAMES                     = ConvertUnitState(131320) // 文本-称谓
    constant unitstate            UNITTYPE_DATATYPEEXT_SCORESCREENICON                = ConvertUnitState(131372) // 显示-图标-计分屏
    constant unitstate            UNITTYPE_DATATYPEEXT_MOVEMENTSOUNDLABEL             = ConvertUnitState(131376) // 声音-移动
    constant unitstate            UNITTYPE_DATATYPEEXT_BUILDINGSOUNDLABEL             = ConvertUnitState(131380) // 声音-建筑
    constant unitstate            UNITTYPE_DATATYPEEXT_LOOPINGSOUNDFADEIN             = ConvertUnitState(131384) // 声音-循环淡入率
    constant unitstate            UNITTYPE_DATATYPEEXT_LOOPINGSOUNDFADEOUT            = ConvertUnitState(131388) // 声音-循环淡出率
    constant unitstate            UNITTYPE_DATATYPEEXT_RANDOMSOOUNDLABEL              = ConvertUnitState(131392) // 声音-随机
    constant unitstate            UNITTYPE_DATATYPEEXT_CASTERUPGRADEART               = ConvertUnitState(131404) // 显示-魔法升级图标
    constant unitstate            UNITTYPE_DATATYPEEXT_CASTERUPGRADENAME              = ConvertUnitState(131416) // 文本-魔法升级名字
    constant unitstate            UNITTYPE_DATATYPEEXT_CASTERUPGRADETIP               = ConvertUnitState(131428) // 文本-魔法升级说明
    constant unitstate            UNITTYPE_DATATYPEEXT_DEPENDENCYOR                   = ConvertUnitState(131440) // 科技树-从属等价物
    constant unitstate            UNITTYPE_DATATYPEEXT_UPGRADE                        = ConvertUnitState(131464) // 科技树-建筑升级
    constant unitstate            UNITTYPE_DATATYPEEXT_BUILDS                         = ConvertUnitState(131488) // 科技树-可建造建筑
    constant unitstate            UNITTYPE_DATATYPEEXT_TRAINS                         = ConvertUnitState(131512) // 科技树-训练单位
    constant unitstate            UNITTYPE_DATATYPEEXT_RESEARCHES                     = ConvertUnitState(131536) // 科技树-可研究项目
    constant unitstate            UNITTYPE_DATATYPEEXT_SELLUNITS                      = ConvertUnitState(131560) // 科技树-出售单位
    constant unitstate            UNITTYPE_DATATYPEEXT_SELLITEMS                      = ConvertUnitState(131584) // 科技树-出售物品
    constant unitstate            UNITTYPE_DATATYPEEXT_MAKEITEMS                      = ConvertUnitState(131608) // 科技树-制造物品
    constant unitstate            UNITTYPE_DATATYPEEXT_REVIVE                         = ConvertUnitState(131612) // 科技树-可重生阵亡英雄
    constant unitstate            UNITTYPE_DATATYPEEXT_REVIVEAT                       = ConvertUnitState(131636) // 科技树-指定复活点
    constant unitstate            UNITTYPE_DATATYPEEXT_SPECIALART                     = ConvertUnitState(131648) // 显示-特殊效果
    constant unitstate            UNITTYPE_DATATYPEEXT_ART                            = ConvertUnitState(131660) // 显示-图标-游戏界面
    constant unitstate            UNITTYPE_DATATYPEEXT_BUTTONPOSX                     = ConvertUnitState(131664) // 显示-按钮位置（X）
    constant unitstate            UNITTYPE_DATATYPEEXT_BUTTONPOSY                     = ConvertUnitState(131668) // 显示-按钮位置（Y）
    constant unitstate            UNITTYPE_DATATYPEEXT_TIP                            = ConvertUnitState(131680) // 文本-提示工具-基础
    constant unitstate            UNITTYPE_DATATYPEEXT_UBERTIP                        = ConvertUnitState(131692) // 文本-提示工具-扩展
    constant unitstate            UNITTYPE_DATATYPEEXT_HOTKEY                         = ConvertUnitState(131704) // 文本-热键
    constant unitstate            UNITTYPE_DATATYPEEXT_REQUIRES                       = ConvertUnitState(131752) // 科技树-需求
    constant unitstate            UNITTYPE_DATATYPEEXT_REQUIRESAMOUNT                 = ConvertUnitState(131776) // 科技树-需求值
    
    // 状态-生命回复类型
    constant integer              UNITTYPE_DATATYPE_ENUM_REGENTYPENONE                         = 0 // 无，没有
    constant integer              UNITTYPE_DATATYPE_ENUM_REGENTYPEALWAYS                       = 1 // 总是
    constant integer              UNITTYPE_DATATYPE_ENUM_REGENTYPEBLIGHT                       = 2 // 只在荒芜地表上
    constant integer              UNITTYPE_DATATYPE_ENUM_REGENTYPEDAY                          = 3 // 只在白天
    constant integer              UNITTYPE_DATATYPE_ENUM_REGENTYPENIGHT                        = 4 // 只在夜晚
    // 战斗-装甲类型
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPESMALL                          = 0 // 小型
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPEMEDIUM                         = 1 // 中型
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPELARGE                          = 2 // 大型
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPEFORT                           = 3 // 城墙
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPENORMAL                         = 4 // 普通
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPEHERO                           = 5 // 英雄
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPEDIVINE                         = 6 // 神圣        
    constant integer              UNITTYPE_DATATYPE_ENUM_DEFTYPENONE                           = 7 // 无装甲

    // 战斗-允许攻击模式
    constant integer              UNITTYPE_DATATYPE_ENUM_WARPSONNONE                           = 0 // 无
    constant integer              UNITTYPE_DATATYPE_ENUM_WARPSONONLY1                          = 1 // 只有攻击1
    constant integer              UNITTYPE_DATATYPE_ENUM_WARPSONONLY2                          = 2 // 只有攻击2
    constant integer              UNITTYPE_DATATYPE_ENUM_WARPSONALL                            = 3 // 全部
    // 战斗-攻击-攻击类型
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPESPELLSORUNKNOWN                = 0 // 法术，没有
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPENORMAL                         = 1 // 普通
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPEPIERCE                         = 2 // 穿刺
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPESIEGE                          = 3 // 攻城
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPEMAGIC                          = 4 // 魔法
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPECHAOS                          = 5 // 混乱
    constant integer              UNITTYPE_DATATYPE_ENUM_ATKTYPEHERO                           = 6 // 英雄
    // 战斗-攻击-武器声音
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPENONE                          = 0 // 没有
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALLIGHTCHOP                = 1 // 金属轻砍
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALMEDIUMCHOP               = 2 // 金属中砍
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALHEAVYCHOP                = 3 // 金属重砍
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALLIGHTSLICE               = 4 // 金属轻切
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALMEDIUMSLICE              = 5 // 金属中切
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALHEAVYSLICE               = 6 // 金属重切
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALMEDIUMBASH               = 7 // 金属中击
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEMETALHEAVYBASH                = 8 // 金属重击
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEWOODLIGHTBASH                 = 14 // 木头轻击
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEWOODMEDIUMBASH                = 15 // 木头中击
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEWOODHEAVYBASH                 = 16 // 木头重击
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEAXEMEDIUMCHOP                 = 22 // 斧头中砍
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTYPEROCKHEAVYBASH                 = 23 // 岩石重击
    // 战斗-攻击-武器类型
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPNONE                            = 0 // 没有
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPNORMAL                          = 1 // 近战
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPMISSILE                         = 2 // 箭矢
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPARTILERY                        = 3 // 炮火
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPINSTANT                         = 4 // 立即
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPMSPLASH                         = 5 // 箭矢（溅射）
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPMBOUNCE                         = 6 // 箭矢（射弹）
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPMLINE                           = 7 // 箭矢（穿透）
    constant integer              UNITTYPE_DATATYPE_ENUM_WEAPTPALINE                           = 8 // 炮火（穿透）
    // 状态-英雄-主要属性
    constant integer              UNITTYPE_DATATYPE_ENUM_PRIMARYSTR                            = 1 // 力量
    constant integer              UNITTYPE_DATATYPE_ENUM_PRIMARYINT                            = 2 // 智力
    constant integer              UNITTYPE_DATATYPE_ENUM_PRIMARYAGI                            = 3 // 敏捷
    // 移动-类型
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPNONE                            = 0 // 没有
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPFOOT                            = 1 // 步行
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPFLY                             = 2 // 飞行
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPHORSE                           = 4 // 骑马
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPHOVER                           = 8 // 浮空（陆）
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPFLOAT                           = 16 // 漂浮（水）
    constant integer              UNITTYPE_DATATYPE_ENUM_MOVETPAMPH                            = 32 // 两栖
    // 路径-AI放置类型
    constant integer              UNITTYPE_DATATYPE_ENUM_BUFFTYPENONE                          = 0 // 没有：0
    constant integer              UNITTYPE_DATATYPE_ENUM_BUFFTYPETOWNHALL                      = 1 // 基地：1
    constant integer              UNITTYPE_DATATYPE_ENUM_BUFFTYPERESOURCE                      = 2 // 资源：2
    constant integer              UNITTYPE_DATATYPE_ENUM_BUFFTYPEFACTORY                       = 4 // 工厂：4
    constant integer              UNITTYPE_DATATYPE_ENUM_BUFFTYPEBUFFER                        = 8 // 普通：8
    // 状态-单位类别
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPETREE                              = 0 // 空白/树木（T）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPEGIANT                             = 1 // 泰坦族（G）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPEUNDEAD                            = 2 // 不死族（U）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPESUMMONED                          = 4 // 召唤生物（S）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPEMECHANICAL                        = 8 // 机械类（M）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPEPEON                              = 16 // 工人（K）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPESAPPER                            = 32 // 自爆工兵（C）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPETOWNHALL                          = 64 // 城镇大厅（H）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPEANCIENT                           = 128 // 古树（A）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPENEUTRAL                           = 256 // 中立（N）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPEWARD                              = 512 // 守卫（D）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPESTANDON                           = 1024 // 可通行（W）
    constant integer              UNITTYPE_DATATYPE_ENUM_TYPETAUREN                            = 2048 // 牛头人（R）
    // 复用-目标类型
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSTERRAIN                          = 0 // 地形
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSNONE                             = 1 // 没有
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSGROUND                           = 2 // 地面
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSAIR                              = 4 // 空中
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSSTRUCTURE                        = 8 // 建筑
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSWARD                             = 16 // 守卫
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSITEM                             = 32 // 物品
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSTREE                             = 64 // 树木
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSWALL                             = 128 // 墙
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSDEBRIS                           = 256 // 残骸
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSDECORATION                       = 512 // 装饰物
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSBRIDGE                           = 1024 // 桥
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSSELF                             = 4096 // 自己
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSPLAYER                           = 8192 // 玩家单位
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSALLIES                           = 16384 // 联盟
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSFRIEND                           = 24576 // 友军单位
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSNEUTRAL                          = 32768 // 中立
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSENEMIES                          = 65536 // 敌人
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSNOTSELF                          = 122880 // 别人
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSVULNERABLE                       = 1048576 // 可攻击的
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSINVULNERABLE                     = 2097152 // 无敌
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSHERO                             = 4194304 // 英雄
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSNONHERO                          = 8388608 // 非-英雄
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSALIVE                            = 16777216 // 存活
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSDEAD                             = 33554432 // 死亡
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSORGANIC                          = 67108864 // 有机生物
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSMECHANICAL                       = 134217728 // 机械类
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSNONSAPPER                        = 268435456 // 非-自爆工兵
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSSAPPER                           = 536870912 // 自爆工兵
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSNONANCIENT                       = 1073741824 // 非-古树
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSANCIENT                          = 2147483648 // 古树
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSEMPTY                            = 4258394126 // 空
    constant integer              UNITTYPE_DATATYPE_ENUM_TARGSALL                              = 4294047743 // 全部
    // 战斗-死亡类型
    constant integer              UNITTYPE_DATATYPE_ENUM_DEATHTYPENRAISENDECAY                 = 0 // 无法召唤，不会腐化
    constant integer              UNITTYPE_DATATYPE_ENUM_DEATHTYPERAISENDECAY                  = 1 // 可召唤，不会腐化
    constant integer              UNITTYPE_DATATYPE_ENUM_DEATHTYPENRAISEDECAY                  = 2 // 无法召唤，会腐化
    constant integer              UNITTYPE_DATATYPE_ENUM_DEATHTYPERAISEDECAY                   = 3 // 可召唤，会腐化
    // 状态-种族
    constant integer              UNITTYPE_DATATYPE_ENUM_RACEUNKNOWN                           = 0 // 无，没有：0
    constant integer              UNITTYPE_DATATYPE_ENUM_RACEHUMAN                             = 1 // 人类
    constant integer              UNITTYPE_DATATYPE_ENUM_RACEORC                               = 2 // 兽族
    constant integer              UNITTYPE_DATATYPE_ENUM_RACEUNDEAD                            = 3 // 不死族
    constant integer              UNITTYPE_DATATYPE_ENUM_RACENIGHTELF                          = 4 // 暗夜精灵
    constant integer              UNITTYPE_DATATYPE_ENUM_RACEDEMON                             = 5 // 恶魔
    constant integer              UNITTYPE_DATATYPE_ENUM_RACEOTHER                             = 7 // 其他
    constant integer              UNITTYPE_DATATYPE_ENUM_RACECREEPS                            = 8 // 野外生物
    constant integer              UNITTYPE_DATATYPE_ENUM_RACECOMMONER                          = 9 // 平民
    constant integer              UNITTYPE_DATATYPE_ENUM_RACECRITTERS                          = 10 // 动物
    constant integer              UNITTYPE_DATATYPE_ENUM_RACENAGA                              = 11 // 娜迦
    // 战斗-装甲类型
    constant integer              UNITTYPE_DATATYPE_ENUM_ARMORNONE                             = 0 // 没有：
    constant integer              UNITTYPE_DATATYPE_ENUM_ARMORFLESH                            = 1 // 肉体
    constant integer              UNITTYPE_DATATYPE_ENUM_ARMORMETAL                            = 2 // 金属
    constant integer              UNITTYPE_DATATYPE_ENUM_ARMORWOOD                             = 3 // 木头
    constant integer              UNITTYPE_DATATYPE_ENUM_ARMORETHEREAL                         = 4 // 气态
    constant integer              UNITTYPE_DATATYPE_ENUM_ARMORSTONE                            = 5 // 石头
    // 路径-放置不允许&路径-放置要求
    constant integer              UNITTYPE_DATATYPE_ENUM_PLACECHECKUNWALKABLE                  = 2 // 可通行的地面
    constant integer              UNITTYPE_DATATYPE_ENUM_PLACECHECKUNFLYABLE                   = 4 // 空中单位可通行
    constant integer              UNITTYPE_DATATYPE_ENUM_PLACECHECKUNBUILDABLE                 = 8 // 可建造的地面
    constant integer              UNITTYPE_DATATYPE_ENUM_PLACECHECKBLIGHTED                    = 32 // 不是荒芜之地
    constant integer              UNITTYPE_DATATYPE_ENUM_PLACECHECKUNFLOAT                     = 64 // 可通行的海面
    constant integer              UNITTYPE_DATATYPE_ENUM_PLACECHECKUNAMPH                      = 128 // 两栖单位可通行

endglobals

//============================================================================
// Neteaese Platform DzAPI
//
    native DzAPI_CommonFunc_SetARGBColorValue takes integer A, integer R, integer G, integer B returns integer
    native DzAPI_CommonFunc_SetARGBColorValuePercent takes real A, real R, real G, real B returns integer
    native DzAPI_CommonFunc_GetARGBColorValue takes integer color, integer channel returns integer
    native DzAPI_CommonFunc_GetARGBColorValuePercent takes integer color, integer channel returns real    
    native DzAPI_UnitstateToInteger takes unitstate datatype returns integer  
    native DzAPI_UnitType_GetUnitTypeDataInt takes integer unitid, unitstate datatype returns integer
    native DzAPI_UnitType_SetUnitTypeDataInt takes integer unitid, unitstate datatype, integer value returns boolean
    native DzAPI_UnitType_GetUnitTypeDataReal takes integer unitid, unitstate datatype returns real
    native DzAPI_UnitType_SetUnitTypeDataReal takes integer unitid, unitstate datatype, real value returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayReal takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayReal takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayReal takes integer unitid, unitstate datatype, integer index returns real
    native DzAPI_UnitType_SetUnitTypeDataArrayReal takes integer unitid, unitstate datatype, integer index, real value returns boolean
    native DzAPI_UnitType_GetUnitTypeDataBoolean takes integer unitid, unitstate datatype returns boolean
    native DzAPI_UnitType_SetUnitTypeDataBoolean takes integer unitid, unitstate datatype, boolean value returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayBoolean takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayBoolean takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayBoolean takes integer unitid, unitstate datatype, integer index returns boolean
    native DzAPI_UnitType_SetUnitTypeDataArrayBoolean takes integer unitid, unitstate datatype, integer index, boolean value returns boolean
    native DzAPI_UnitType_GetUnitTypeDataString takes integer unitid, unitstate datatype returns string 
    native DzAPI_UnitType_SetUnitTypeDataString takes integer unitid, unitstate datatype, string value returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayString takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayString takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayString takes integer unitid, unitstate datatype, integer index returns string
    native DzAPI_UnitType_SetUnitTypeDataArrayString takes integer unitid, unitstate datatype, integer index, string str returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayTechID takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayTechID takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayTechID takes integer unitid, unitstate datatype, integer index returns integer
    native DzAPI_UnitType_SetUnitTypeDataArrayTechID takes integer unitid, unitstate datatype, integer index, integer id returns boolean
    native DzAPI_UnitType_GetUnitTypeDataAbilID takes integer unitid, unitstate datatype returns integer
    native DzAPI_UnitType_SetUnitTypeDataAbilID takes integer unitid, unitstate datatype, integer value returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayAbilID takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayAbilID takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayAbilID takes integer unitid, unitstate datatype, integer index returns integer
    native DzAPI_UnitType_SetUnitTypeDataArrayAbilID takes integer unitid, unitstate datatype, integer index, integer id returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayUnitID takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayUnitID takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayUnitID takes integer unitid, unitstate datatype, integer index returns integer
    native DzAPI_UnitType_SetUnitTypeDataArrayUnitID takes integer unitid, unitstate datatype, integer index, integer id returns boolean
    native DzAPI_UnitType_CountUnitTypeDataArrayItemID takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataArrayItemID takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataArrayItemID takes integer unitid, unitstate datatype, integer index returns integer
    native DzAPI_UnitType_SetUnitTypeDataArrayItemID takes integer unitid, unitstate datatype, integer index, integer id returns boolean
    native DzAPI_UnitType_GetEnum_regenType takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_regenType takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_defType takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_defType takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_warpsOn takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_warpsOn takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_atkType takes integer unitid, boolean isweapon1 returns integer
    native DzAPI_UnitType_SetEnum_atkType takes integer unitid, boolean isweapon1, integer value returns boolean
    native DzAPI_UnitType_GetEnum_weapType takes integer unitid, boolean isweapon1 returns integer
    native DzAPI_UnitType_SetEnum_weapType takes integer unitid, boolean isweapon1, integer value returns boolean
    native DzAPI_UnitType_GetEnum_weapTp takes integer unitid, boolean isweapon1 returns integer
    native DzAPI_UnitType_SetEnum_weapTp takes integer unitid, boolean isweapon1, integer value returns boolean
    native DzAPI_UnitType_GetEnum_Primary takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_Primary takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_movetp takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_movetp takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_buffType takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_buffType takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_race takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_race takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_deathType takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_deathType takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_armor takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_armor takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_TargetTypeSeries takes integer unitid, unitstate datatype returns integer
    native DzAPI_UnitType_SetEnum_TargetTypeSeries takes integer unitid, unitstate datatype, integer value returns boolean
    native DzAPI_UnitType_GetEnum_TargetTypeCheck takes integer value, integer datatype returns boolean
    native DzAPI_UnitType_SetEnum_TargetTypeModify takes integer value, integer datatype, boolean isAble returns integer
    native DzAPI_UnitType_GetEnum_type takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_type takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_typeCheck takes integer value, integer datatype returns boolean
    native DzAPI_UnitType_SetEnum_typeModify takes integer unitid, integer datatype, boolean isAble returns integer
    native DzAPI_UnitType_GetEnum_PreventOrReguirePlace takes integer unitid returns integer
    native DzAPI_UnitType_SetEnum_PreventOrReguirePlace takes integer unitid, integer value returns boolean
    native DzAPI_UnitType_GetEnum_PreventOrReguirePlaceCheck takes integer value, integer datatype, boolean isPrevent returns boolean
    native DzAPI_UnitType_SetEnum_PreventOrReguirePlaceModify takes integer unitid, integer datatype, boolean isAble, boolean isPrevent returns integer
    native DzAPI_UnitType_GettUnitTypeDataRequirescount takes integer unitid returns integer
    native DzAPI_UnitType_CountUnitTypeDataRequires takes integer unitid, unitstate datatype, integer level, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataRequires takes integer unitid, unitstate datatype, integer level, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataRequires takes integer unitid, unitstate datatype, integer level, integer index returns integer
    native DzAPI_UnitType_SetUnitTypeDataRequires takes integer unitid, unitstate datatype, integer level, integer index, integer value returns boolean
    native DzAPI_UnitType_CountUnitTypeDataRequiresamount takes integer unitid, unitstate datatype, integer sizetype returns integer
    native DzAPI_UnitType_ResizeUnitTypeDataRequiresamount takes integer unitid, unitstate datatype, integer count returns boolean
    native DzAPI_UnitType_GetUnitTypeDataRequiresamount takes integer unitid, unitstate datatype, integer index returns integer
    native DzAPI_UnitType_SetUnitTypeDataRequiresamount takes integer unitid, unitstate datatype, integer index, integer value returns boolean