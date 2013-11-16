var define = function (object, name, value) {
  var key;

  // if an object, loop the properties for the definitions
  if (typeof name === "object") {
    for (key in name) {
      if (name.hasOwnProperty(key)) {
        define(object, key, name[key]);
      }
    }
    // otherwise, just operate on a single property
  } else {
    Object.defineProperty(object, name, {
      value:        value,
      enumerable:   true,
      writable:     false,
      configurable: false
    });
  }

  return object;
};

var constants = {};
define(constants, {
  PREFS_IS_ENABLED					: "IsEnabled",
  PREFS_AUTOMATICALLY_OPEN_TORRENT	: "AutomaticallyOpenTorrent",
  PREFS_TORRENT_FOLDER				: "TorrentFolder",
  PREFS_QUALITY						: "Quality",
  PREFS_SCRIPTVERSION					: "ScriptVersion",
  PREFS_LASTVERSIONCHECK				: "SULastCheckTime",

  // "SeasonEpisodeType"	# Shows organised by season/episode (eg: Lost)
  TYPE_SEASONEPISODE					: "SeasonEpisodeType",
  // "DateType"			# Shows organised by date (eg: The Daily Show)
  TYPE_DATE							: "DateType",
  // "TimeType"			# Shows not organised at all (eg: Dicovery Channel), so we organize them by published time
  TYPE_TIME							: "TimeType",

  SHOWS_SHOWS							: "Shows",
  SHOWS_VERSION						: "Version",
  SHOW_HUMANNAME						: "HumanName",
  SHOW_EXACTNAME						: "ExactName",
  SHOW_EPISODE						: "Episode",
  SHOW_SEASON							: "Season",
  SHOW_SUBSCRIBED						: "Subscribed",
  SHOW_DATE							: "Date",
  SHOW_TITLE							: "Title",
  SHOW_TYPE							: "Type",
  SHOW_TIME							: "Time",

  FEED : "http://ezrss.it/search/index.php?show_name:%s&show_name_exact:true&mode:rss",
  REQUIRED_KEYS : ["SHOW_HUMANNAME","SHOW_EXACTNAME","SHOW_SUBSCRIBED","SHOW_TYPE"],
  QUALITIES : ["HD","WS","DSRIP","TVRIP","PDTV","DVD","HR","720"]
});

exports.constants = constants;
