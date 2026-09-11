require('dotenv').config();
const pm2 = require('pm2');
const { exec } = require('child_process');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session')
const path = require('path');
const csrf = require('lusca').csrf;
const sharp = require('sharp');

const db = new sqlite3.Database('main.db', err => {
    if (err) {
        console.error("SQLite open error:", err);
    } else {
        console.log("SQLite database connected");
    }
});

const multer = require('multer');
const { env } = require('process');
const { ERROR } = require('sqlite3');
const { match } = require('assert');
const replayCloud = multer({ dest: 'replay-cloud/' });

process.on("uncaughtException", err => {
    console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
    console.error("UNHANDLED REJECTION:", err);
});


const image = multer.diskStorage({
    destination: function (req, file, cb) {
        const token = req.headers['x-access-jsonwebtoken']
        const uid = req.uid
        fs.mkdirSync('image-cloud/' + uid, { recursive: true });
        cb(null, 'image-cloud/' + uid + "/");
    },
    filename: function (req, file, cb) {
        cb(null, crypto.randomUUID() + `.png`);
    }
});
const imageCloud = multer({ storage: image });

const replaydest = multer.diskStorage({
    destination: function (req, file, cb) {
        const uid = req.uid
        fs.mkdirSync('replay/' + uid, { recursive: true });
        cb(null, 'replay/' + uid + "/");
    },
    filename: function (req, file, cb) {
        cb(null, crypto.randomUUID());
    }
});

const replay = multer({ storage: replaydest });


const app = express();
const PORT = process.env.PORT || 8080;
const url = process.env.URL || `http://localhost:${PORT}`;


app.set('query parser', 'extended');


app.use(rateLimit({
    windowMs: 60_000,
    max: 1000
}));


//TODO: finnish maps IE duplicating and stuff
//TODO: Get tournaments working ???
//TODO: Better documentation


/*
-------------------------------------------------
████████╗ █████╗ ██████╗ ██╗     ███████╗███████╗
╚══██╔══╝██╔══██╗██╔══██╗██║     ██╔════╝██╔════╝
   ██║   ███████║██████╔╝██║     █████╗  ███████╗
   ██║   ██╔══██║██╔══██╗██║     ██╔══╝  ╚════██║
   ██║   ██║  ██║██████╔╝███████╗███████╗███████║
   ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝╚══════╝
-------------------------------------------------
*/

const normalizeDate = (value) =>
    value ? new Date(value).toISOString() : new Date().toISOString();


app.use((req, res, next) => {
    console.log(req.url)
    next();
})

app.use((req, res, next) => {
    res.setTimeout(20000, () => {
        console.error("Request timed out on ", req.url);
        res.status(504).json({ success: false });
    });
    next();
});


db.serialize(() => {
    db.run("PRAGMA journal_mode=WAL;");


    //tournaments

    db.run(`CREATE TABLE IF NOT EXISTS tournaments (
        players_size INT,
        max_players INT,
        id TEXT,
        guid TEXT UNIQUE,
        title TEXT,
        region TEXT,
        lan_support BOOLEAN,
        server_ip TEXT,
        call_to_action TEXT,
        description TEXT,
        prize_description TEXT,
        prize_url TEXT,
        image_url TEXT,
        video_url TEXT,
        allow_new_registration BOOLEAN,
        disable_public_spectators BOOLEAN,
        register_start DATETIME,
        register_end DATETIME,
        current_time DATETIME,
        penalty BOOLEAN,
        status TEXT,
        progression TEXT,
        drone_guid TEXT,
        drl_pilot_mode BOOLEAN,
        default_drone_class INT,
        minimum_skill INT,
        streaming_url TEXT,
        private BOOLEAN,
        dawc_seeding BOOLEAN,
        countdown BOOLEAN,
        rounds TEXT,
        rankings TEXT,
        age_check BOOLEAN,
        age_check_number INT,
        terms_and_conditions_url TEXT,
        type TEXT,
        player_ids TEXT,
        ranking TEXT,

        automated_tournament BOOLEAN,
        recurr_every_days INT,
        map_pool TEXT,

        map TEXT,
        track TEXT,
        is_custom_map BOOLEAN,
        custom_map TEXT,
        custom_map_title TEXT
        )`);


    db.run(`CREATE TABLE IF NOT EXISTS tournamentrounds (
    guid TEXT NOT NULL,
    title TEXT,
    roundNumber INT NOT NULL,
    status TEXT,
    norder INT,
    start_at DATETIME,
    end_at DATETIME,
    map TEXT,
    track TEXT,
    is_custom_map BOOLEAN,
    custom_map TEXT,
    custom_map_title TEXT,
    multiplayer_countdown BOOLEAN,
    mode TEXT,
    timeout INT,
    roundId TEXT,
    PRIMARY KEY (roundNumber, guid)
    )`);


    db.run(`CREATE TABLE IF NOT EXISTS tournamentroundmatches (
    roundNumber INT NOT NULL,
    guid TEXT NOT NULL,
    id TEXT NOT NULL,
    round_id TEXT,
    round_norder INT,
    map TEXT,
    track TEXT,
    is_custom_map BOOLEAN,
    custom_map TEXT,
    custom_map_title TEXT,
    multiplayer_room_timer BOOLEAN,
    is_under_review BOOLEAN,
    players_size INT,
    throttle_cap FLOAT,
    current_heat INT,
    active_heat INT,
    status TEXT,
    norder INT,
    heats INT,
    num_winners INT,
    start_at DATETIME,
    end_at DATETIME,
    progress INT,
    default_drone_class INT,
    mode TEXT,
    parents TEXT,
    player_ids TEXT,
    player_order TEXT,

    PRIMARY KEY (roundNumber, guid, id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tournamentroundscoring (
    guid TEXT NOT NULL,
    player_id TEXT NOT NULL,
    matchID TEXT NOT NULL,
    success BOOLEAN,
    heat INT NOT NULL,
    score INT,
    points INT,
    status TEXT,
    position INT,
    crashes INT,
    race_id TEXT,

    PRIMARY KEY (matchID, guid, heat, player_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tournamentmatchplayerdata (
    guid TEXT NOT NULL,
    player_id TEXT NOT NULL,
    matchID TEXT NOT NULL,
    points INT,
    score INT,
    score_total INT,
    position INT,
    total_wins INT,
    is_winner BOOLEAN,
    is_winner_second BOOLEAN,

    PRIMARY KEY (matchID, guid, player_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tournamentoverallplayerdata (
    guid TEXT NOT NULL,
    player_id TEXT NOT NULL,
    points INT,
    score INT,
    score_total INT,
    position INT,
    total_wins INT,
    is_winner BOOLEAN,
    is_winner_second BOOLEAN,

    PRIMARY KEY (guid, player_id)
    )`);
    /*
db.run("CREATE TABLE IF NOT EXISTS tournamentsubscribed (uid TEXT, guid TEXT, PRIMARY KEY (uid, guid))");
*/


    db.run(`CREATE TABLE IF NOT EXISTS profilestatemodel (
    system_info TEXT,
    player_id TEXT UNIQUE,
    steam_id TEXT,
    xbuid TEXT,
    playstation_id TEXT,
    branch_id TEXT,
    steam_install_path TEXT,
    steam_purchase_unix_seconds TEXT,
    profile_name TEXT,
    profile_block_list TEXT,
    profile_developer BOOLEAN,
    profile_reward_parts TEXT,
    profile_photo_url TEXT,
    profile_photo_size INT,
    profile_custom_photo_url TEXT,
    profile_steam_photo_url TEXT,
    profile_color TEXT,
    profile_language_iso TEXT,
    profile_country_iso TEXT,
    profile_full_name TEXT,
    profile_email TEXT,
    profile_age INT,
    profile_country TEXT,
    profile_gender TEXT,
    profile_score FLOAT,
    has_review BOOLEAN,
    prompt_review BOOLEAN,
    is_drl_pilot BOOLEAN,
    fps_limit INT,
    profile_watch_drl TEXT,
    profile_american_citizen TEXT,
    profile_experience_non_fpv TEXT,
    profile_experience_non_fpv_years TEXT,
    profile_experience_fpv TEXT,
    profile_experience_fpv_years TEXT,
    profile_experience_preference_fpv TEXT,
    profile_experience_real_life_racing TEXT,
    profile_experience_built_own_drone TEXT,
    profile_affiliation_multigp TEXT,
    profile_affiliation_military TEXT,
    profile_affiliation_ama TEXT,
    profile_polls TEXT,
    profile_paywall_dismiss BOOLEAN,
    profile_physics_intro BOOLEAN,
    profile_user_rank INT,
    profile_data_completion FLOAT,
    profile_inventory TEXT,
    flight_time FLOAT,
    reset_delay FLOAT,
    xbox_privacy_ugc_blocked BOOLEAN,
    ps4_privacy_ugc_blocked BOOLEAN,
    storage_replay_file_count INT,
    storage_replay_memory_usage TEXT,
    dmv_welcome_screen BOOLEAN,
    dmv_total_time FLOAT,
    fcmode_active INT,
    fcmode_active_missions INT,
    network_server_region INT,
    network_connected_region INT,
    settings_controller_profiles TEXT,
    settings_controller_profile_active_guid TEXT,
    settings_controller_using_adapter BOOLEAN,
    settings_fc_profiles TEXT,
    settings_fc_profile_active_guid TEXT,
    settings_audio_volume_main FLOAT,
    settings_audio_volume_music FLOAT,
    settings_audio_volume_sfx FLOAT,
    settings_audio_ui_enabled BOOLEAN,
    settings_audio_motor_enabled BOOLEAN,
    settings_graphics_resolution_x FLOAT,
    settings_graphics_resolution_y FLOAT,
    settings_graphics_fullscreen BOOLEAN,
    settings_graphics_vsync INT,
    settings_graphics_fps_limit INT,
    settings_graphics_mode INT,
    settings_graphics_exclusive_mode BOOLEAN,
    settings_graphics_advanced_rendering BOOLEAN,
    settings_graphics_quality INT,
    settings_graphics_effects_quality INT,
    settings_graphics_details_quality INT,
    settings_graphics_tier INT,
    settings_graphics_post_processing INT,
    settings_graphics_texture INT,
    settings_graphics_antialias INT,
    settings_graphics_shadows INT,
    settings_graphics_ambient_occlusion INT,
    settings_graphics_dof INT,
    settings_graphics_motion_blur BOOLEAN,
    settings_graphics_water_reflection BOOLEAN,
    settings_graphics_brightness FLOAT,
    settings_graphics_render_scale FLOAT,
    settings_game_race_path BOOLEAN,
    settings_game_race_guide BOOLEAN,
    settings_game_gate_markers BOOLEAN,
    settings_game_race_stats BOOLEAN,
    settings_game_race_fast_reset BOOLEAN,
    settings_radio_noise BOOLEAN,
    settings_game_race_auto_standings BOOLEAN,
    settings_game_fps_warning BOOLEAN,
    settings_game_controller_overlay BOOLEAN,
    settings_game_trails BOOLEAN,
    settings_battery_resistance_min FLOAT,
    settings_battery_resistance_max FLOAT,
    settings_battery_resistance FLOAT,
    settings_battery_capacity FLOAT,
    settings_game_trails_duration FLOAT,
    settings_game_tuning_promode BOOLEAN,
    settings_game_lens_distortion BOOLEAN,
    settings_game_props_visibility BOOLEAN,
    settings_game_arm_and_turtle BOOLEAN,
    settings_game_propwash INT,
    settings_game_crosshair BOOLEAN,
    settings_game_chat BOOLEAN,
    settings_game_damage BOOLEAN,
    settings_game_hotkeys BOOLEAN,
    settings_game_crossplay BOOLEAN,
    settings_game_race_line_color INT,
    settings_game_check_point_color INT,
    settings_graphics_screen_space_reflection TEXT,
    results_list TEXT,
    campaigns_attempts_table TEXT,
    campaigns_regions_table TEXT,
    campaigns_new_highscore_table TEXT,
    campaigns_terms_accept_table TEXT,
    campaigns_register_info_table TEXT,
    garage_rigs TEXT,
    garage_active_rig TEXT,
    physics_tunes TEXT,
    physics_active_tune TEXT,
    physics_tune_warning BOOLEAN,
    settings_language INT,
    settings_notification_state_menu INT,
    settings_notification_state_ingame INT,
    circuits_opponent_mode INT,
    circuits_opponent_difficulty INT,
    onboarding_started BOOLEAN,
    onboarding_progress_beginner INT,
    onboarding_progress_intermediate INT,
    onboarding_progress_pro INT,
    onboarding_progress_proMissions INT,
    onboarding_progress_steps_beginner TEXT,
    onboarding_progress_steps_intermediate TEXT,
    onboarding_progress_steps_pro TEXT,
    onboarding_clicked_mission BOOLEAN,
    onboarding_orientation BOOLEAN,
    onboarding_sensitivity TEXT,
    maps_favorite TEXT,
    invalidate_settings_cache BOOLEAN,
    clear_maps_cache BOOLEAN,
    blocked_users TEXT,
    is_observer BOOLEAN,
    is_commentator BOOLEAN
    );`)


    db.run("CREATE TABLE IF NOT EXISTS tournamentsregistered (uid TEXT, guid TEXT, PRIMARY KEY (uid, guid))");




    db.run(`
    CREATE TABLE IF NOT EXISTS map_pools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pool_name TEXT NOT NULL UNIQUE
    )
    `);

    db.run(`
    CREATE TABLE IF NOT EXISTS poolmaps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map TEXT,
        track TEXT,
        is_custom_map TEXT,
        custom_map TEXT,
        custom_map_title TEXT,
        pool_id INTEGER,
        UNIQUE (custom_map, pool_id)
        FOREIGN KEY (pool_id) REFERENCES map_pools(id)
    )
    `);


    // Login
    db.run(`CREATE TABLE IF NOT EXISTS adminusers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    db.run("CREATE TABLE IF NOT EXISTS user (uid TEXT UNIQUE, token TEXT, expires INTEGER, name TEXT)");

    db.run("CREATE TABLE IF NOT EXISTS trackcolab (uid TEXT, guid TEXT, PRIMARY KEY (uid, guid))");
    //tracks
    db.run("CREATE TABLE IF NOT EXISTS trackupdates (uid TEXT UNIQUE, tracks TEXT)");
    //leaderboard
    db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    player_id TEXT NOT NULL,
    map TEXT NOT NULL,
    track TEXT NOT NULL,
    diameter INT NOT NULL,
    drl_official BOOLEAN NOT NULL,

    drone_name TEXT NOT NULL,
    drone_guid TEXT NOT NULL,
    profile_platform_id TEXT,
    username TEXT,
    profile_color TEXT,
    profile_thumb TEXT,
    profile_name TEXT,
    profile_platform TEXT,
    is_custom_map BOOLEAN NOT NULL,
    custom_map TEXT,
    mission TEXT,
    group_id TEXT,
    region TEXT,
    replay_url TEXT,
    game_type TEXT,
    drone_thumb TEXT,
    multiplayer BOOLEAN,
    multiplayer_room_id TEXT,
    multiplayer_room_size INT,
    multiplayer_player_id TEXT,
    multiplayer_master_id TEXT,
    multiplayer_player_position INT,
    flag_url TEXT,
    score_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    match_id TEXT DEFAULT 'normal',
    race_status TEXT DEFAULT 'Success',
    tryouts BOOLEAN,
    battery_resistance FLOAT,
    controller_type TEXT,
    position INT,
    score INT,
    score_check INT,
    score_double_check INT,
    score_cheat BOOLEAN,
    score_cheat_ratio FLOAT,
    score_cheat_samples TEXT,
    crash_count INT,
    top_speed FLOAT,
    time_in_first FLOAT,
    lap_times TEXT,
    gate_times TEXT,
    fastest_lap INT,
    slowest_lap INT,
    total_distance FLOAT,
    percentile FLOAT,
    order_col INT,
    high_score BOOLEAN,
    race_id TEXT,
    limit_col INT,
    heat INT DEFAULT -1,
    custom_physics BOOLEAN,
    drl_pilot_mode BOOLEAN,
    drone_rig TEXT,
    drone_hash TEXT,

    PRIMARY KEY (player_id, map, track, diameter, drl_official, custom_map, match_id, race_status, heat)
    );`);


    //drones
    db.run(`CREATE TABLE IF NOT EXISTS drone (
        guid TEXT UNIQUE,
        player_id TEXT,
        profile_platform_id TEXT,
        profile_platform TEXT,
        profile_color TEXT,
        profile_thumb TEXT,
        profile_name TEXT,
        score FLOAT,
        rating FLOAT,
        rating_count INT,
        thumb_url TEXT,
        name TEXT,
        is_public BOOLEAN,
        is_official BOOLEAN,
        is_custom_physics BOOLEAN,
        flight_time FLOAT,
        flight_total FLOAT,
        size INT,
        thrust FLOAT,
        speed FLOAT,
        weight FLOAT,
        rpm FLOAT,
        frame_id TEXT,
        motor_id TEXT,
        prop_id TEXT,
        battery_id TEXT,
        rig_data TEXT,
        profile_data TEXT,
        physics_data TEXT
        );`);
    //player info
    db.run(`CREATE TABLE IF NOT EXISTS playerprogression (
        uid TEXT UNIQUE,
        xp INT,
        previous_level_xp INT,
        next_level_xp INT,
        level INT,
        rank_name TEXT,
        rank_index INT,
        rank_position INT,
        rank_round_start TEXT,
        rank_round_end TEXT,
        league_name TEXT,
        league_guid TEXT,
        streak_date_start TEXT,
        streak_date_end TEXT,
        streak_points INT,
        daily_completed_maps INT,
        goal_daily_completed_maps INT,
        prizes TEXT,
        xp_this_week INT,
        weekstart TEXT,
        weekend TEXT
        );`);

    //tracks
    db.run("CREATE TABLE IF NOT EXISTS trackroots (root TEXT, guid TEXT UNIQUE)");
    db.run(`CREATE TABLE IF NOT EXISTS communitytracks (
            guid TEXT UNIQUE,
            root TEXT,
            prefs TEXT,
            allow_copy BOOLEAN,
            base_assets_enabled BOOLEAN,
            exclusive_by_platform TEXT,
            is_race_allowed BOOLEAN,
            is_public BOOLEAN,
            is_public_for_drlpilots BOOLEAN,
            is_drl_official BOOLEAN,
            is_featured BOOLEAN,
            is_multigp BOOLEAN,
            is_tryouts BOOLEAN,
            is_virtual_season BOOLEAN,
            map_category TEXT,
            map_difficulty INT,
            map_distance FLOAT,
            map_dirty BOOLEAN,
            map_lighting INT,
            map_laps INT,
            map_stats_triangle_count INT,
            map_stats_object_count INT,
            map_asset_layers TEXT,
            map_styles TEXT,
            categories TEXT,
            prefs_auto_save BOOLEAN,
            rating_count INT,
            score INT,
            track_id TEXT,
            xp_value INT,
            xp_min_time INT,
            cm_collectable_count INT,
            collaborators TEXT,
            map_mode_type TEXT,
            map_id TEXT,
            map_title TEXT,
            steam_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            version INT,
            title_translations TEXT,
            images TEXT,
            map_thumb TEXT,
            avatar TEXT,
            player_id TEXT,
            profile_name TEXT,
            profile_thumb TEXT,
            profile_color TEXT,
            profile_platform TEXT,
            profile_platform_id TEXT,
            flag_url TEXT,
            is_avatar_blocked BOOLEAN,
            full_track_url TEXT
            );`);
    //db.run("DROP TABLE tournamentroundmatches")
});

function shuffle(array) {
    let currentIndex = array.length;


    while (currentIndex != 0) {


        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;


        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array
}

const badTokenAuthv2 = (req, res, next) => {
    const token = req.headers['x-access-jsonwebtoken'] || req.query.token;
    db.get(`SELECT uid, expires FROM user WHERE token = ?`, [token], (err, row) => {
        if (err || !row) {
            console.error("Error fetching UID:", err);
            res.status(404).json({ success: false });
            return;
        } else if (row.expires === -1) {
            console.error("Banned token used");
            res.status(401).json({ success: false, message: "Token banned" });
            return;
        } else if (row.expires != 0 && row.expires < Math.floor(Date.now() / 1000)) {
            console.error("Error fetching UID: Token expired");
            res.status(401).json({ success: false, message: "Token invalid" });
            return;
        } else {
            req.uid = row.uid;
            next()
        }
    })
}




/*
----------------------------------------------------------------------------------------------------------------------
███╗   ███╗ █████╗ ██████╗ ███████╗     █████╗ ███╗   ██╗██████╗     ████████╗██████╗  █████╗  ██████╗██╗  ██╗███████╗
████╗ ████║██╔══██╗██╔══██╗██╔════╝    ██╔══██╗████╗  ██║██╔══██╗    ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝
██╔████╔██║███████║██████╔╝███████╗    ███████║██╔██╗ ██║██║  ██║       ██║   ██████╔╝███████║██║     █████╔╝ ███████╗
██║╚██╔╝██║██╔══██║██╔═══╝ ╚════██║    ██╔══██║██║╚██╗██║██║  ██║       ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ╚════██║
██║ ╚═╝ ██║██║  ██║██║     ███████║    ██║  ██║██║ ╚████║██████╔╝       ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗███████║
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝    ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝        ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
----------------------------------------------------------------------------------------------------------------------
*/

function TOJSON(value) {
    if (!value) return [];

    if (typeof value === "string") {
        value = value.trim();
        if (value === "[]" || value === "{}" || value === "null") return [];
        try {
            return JSON.parse(value);
        } catch (e) {
            console.warn("TOJSON failed to parse string, returning original value:", value);
            return value;
        }
    }

    return value;
}

function mapCTracksqlToJson(row) {
    try {
        let data = {
            "guid": row.guid,
            "root": TOJSON(row.root),
            "prefs": TOJSON(row.prefs),
            "allow-copy": row.allow_copy,
            "base-assets-enabled": row.base_assets_enabled,
            "exclusive-by-platform": TOJSON(row.exclusive_by_platform),
            "is-race-allowed": row.is_race_allowed,
            "is-public": row.is_public,
            "is-public-for-drlpilots": row.is_public_for_drlpilots,
            "is-drl-official": row.is_drl_official,
            "is-featured": row.is_featured,
            "is-multigp": row.is_multigp,
            "is-tryouts": row.is_tryouts,
            "is-virtual-season": row.is_virtual_season,
            "map-category": row.map_category,
            "map-difficulty": row.map_difficulty,
            "map-distance": row.map_distance,
            "map-dirty": row.map_dirty,
            "map-lighting": row.map_lighting,
            "map-laps": row.map_laps,
            "map-stats-triangle-count": row.map_stats_triangle_count,
            "map-stats-object-count": row.map_stats_object_count,
            "map-asset-layers": TOJSON(row.map_asset_layers),
            "map-styles": TOJSON(row.map_styles),
            "categories": TOJSON(row.categories),
            "prefs-auto-save": row.prefs_auto_save,
            "rating-count": row.rating_count,
            "score": row.score,
            "track-id": row.track_id,
            "xp-value": row.xp_value,
            "xp-min-time": row.xp_min_time,
            "cm-collectable-count": row.cm_collectable_count,
            "collaborators": TOJSON(row.collaborators),
            "map-mode-type": row.map_mode_type,
            "map-id": row.map_id,
            "map-title": row.map_title,
            "steam-id": row.steam_id,
            "created-at": row.created_at,
            "updated-at": row.updated_at,
            "version": row.version,
            "title-translations": TOJSON(row.title_translations),
            "images": TOJSON(row.images),
            "map-thumb": row.map_thumb,
            "avatar": row.avatar,
            "player-id": row.player_id,
            "profile-name": row.profile_name,
            "profile-thumb": row.profile_thumb,
            "profile-color": row.profile_color,
            "profile-platform": row.profile_platform,
            "profile-platform-id": row.profile_platform_id,
            "flag-url": row.flag_url,
            "is-avatar-blocked": row.is_avatar_blocked,
            "full-track-url": url + row.full_track_url
        }
        return data
    } catch (E) {
        console.error("Error mapping tournament SQL to JSON:", E);
        return {};
    }
}

app.post('/maps/:guid/duplicate', express.urlencoded({ limit: "100mb", extended: true }), rateLimit({ windowMs: 60_000, max: 10 }), badTokenAuthv2, (req, res) => {
    const baseDir = path.join(__dirname, 'tracks');
    const finalPath = path.resolve(baseDir, req.params.guid + '.cmp');

    if (!finalPath.startsWith(baseDir)) {
        return res.status(403).send('Forbidden: Invalid path');
    }

    if (!fs.existsSync(finalPath)) {
        return res.status(404).end();
    }
    res.sendFile(finalPath);
});

//path for track downloads
app.get('/tracks/:id', (req, res) => {
    console.log("req sent to /tracks/ for id:", req.params.id)
    db.get(`SELECT c.*,
                COALESCE(p.player_id, c.player_id) AS player_id,
                COALESCE(p.profile_name, c.profile_name) AS profile_name,
                COALESCE(p.profile_photo_url, c.profile_thumb) AS profile_thumb,
                COALESCE(p.profile_color, c.profile_color) AS profile_color,
                t.root AS root
                
                FROM communitytracks c LEFT JOIN profilestatemodel p ON p.player_id = c.player_id LEFT JOIN trackroots t ON t.guid = c.guid WHERE c.guid = ?`, [req.params.id], (err, row) => {
        if (err) {
            console.error("Error fetching community track:", err);
            return res.status(500).json({ success: false });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: "Track not found" });
        }
        const trackData = mapCTracksqlToJson(row);
        res.status(200).json({ success: true, data: { pagging: { page: 1, "page-total": 1 }, data: [trackData] } });
    });
});


app.get('/progression/maps/', (req, res) => {
    let progressionMaps = [];
    db.all(`SELECT * FROM communitytracks WHERE map_category != 'MapCommon'`, (err, Track) => {
        for (let i = 0; i < Track.length; i++) {
            let data = {
                guid: Track[i].guid,
                "name": Track[i]["map_title"],
                "xp-value": Track[i]["xp_value"]
            }
            progressionMaps.push(data);
        }
        res.status(200).json({
            success: true, data: progressionMaps
        });
    });
})



app.get('/maps/updated/', (req, res) => {
    console.log("req sent to /maps/updated/")
    const token = req.headers['x-access-jsonwebtoken']
    db.all(`SELECT * FROM communitytracks WHERE map_category != 'MapCommon' AND is_public = 1`, (err, Track) => {
        db.get(`SELECT uid, expires FROM user WHERE token = ?`, [token], (err, row) => {
            if (err || !row) {
                console.error("Error fetching UID:", err);
                for (let i = 0; i < Track.length; i++) {
                    Track[i] = mapCTracksqlToJson(Track[i]);
                }
                res.status(200).json(Track);
                return;
            } else if (row.expires < Math.floor(Date.now() / 1000)) {
                console.error("Error fetching UID: Token expired");
                res.status(401).json({ success: false, message: "Token invalid" });
                return;
            } else {
                const uid = row.uid
                db.get(`SELECT tracks FROM trackupdates WHERE uid = ?`, [uid], (err, row) => {
                    if (err || !row) {
                        console.error("Error fetching user tracks:", err);
                        for (let i = 0; i < Track.length; i++) {
                            Track[i] = mapCTracksqlToJson(Track[i]);
                        }
                        return res.status(200).json(Track);
                    }
                    let payload = [];
                    let localTracks = JSON.parse(JSON.parse(row.tracks).maps);
                    const localMap = new Map();
                    for (const t of localTracks) {
                        localMap.set(t.guid, t.version);
                    }
                    for (const dbTrack of Track) {
                        const localVersion = localMap.get(dbTrack.guid);
                        if (localVersion === undefined) {
                            payload.push(mapCTracksqlToJson(dbTrack));
                        }
                        if (localVersion !== dbTrack.version) {
                            payload.push(mapCTracksqlToJson(dbTrack));
                        }
                    }
                    if (payload.length === 0) {
                        console.log("No updated tracks for user", uid, "returning tracks");

                        //Do this bc the game is slow and will mess up usernames?
                        setTimeout(() => {
                            return res.status(200).json(payload);
                        }, 10000);
                    } else {
                        res.status(200).json(payload);
                    }
                });
            }
        });
    });
});
/*
app.post('/maps/updated/', express.urlencoded({ extended: false }), (req, res) => {
    console.log("req sent to /maps/updated/ via POST")
    console.log(req.body);
    console.log(req.headers)
    res.status(200).json({ success: true });
})
*/

app.post('/maps/updated/', express.urlencoded({ extended: false }), badTokenAuthv2, (req, res) => {
    console.log("req sent to /maps/updated/ via POST")
    const token = req.headers['x-access-jsonwebtoken']
    console.log(JSON.stringify(req.body))
    db.run(`INSERT INTO trackupdates (uid, tracks) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET tracks = excluded.tracks`, [req.uid, JSON.stringify(req.body)], function (err) {
        if (err) {
            console.error("Error inserting track update:", err);
            res.status(500).json({ success: false });
        } else {
            res.status(200).json({ success: true });
        }
    });
});


app.get('/maps/user/updated/', express.urlencoded({ extended: false }), badTokenAuthv2, (req, res) => {
    const token = req.headers['x-access-jsonwebtoken']
    console.log("req sent to /maps/user/updated/")
    let payload = []
    const uid = req.uid
    db.all(`SELECT ct.*
                FROM communitytracks ct
                INNER JOIN trackcolab tc ON ct.guid = tc.guid
                WHERE tc.uid = ?`, [uid], (err, row) => {
        if (err) {
            console.error("Error fetching community tracks:", err);
            return res.status(500).json({ success: false });
        }
        for (let i = 0; i < row.length; i++) {
            let data = mapCTracksqlToJson(row[i]);
            payload.push(data);
        }
        console.log("Returned", payload, "tracks for user", uid);
        res.status(200).json({ success: true, data: { data: payload, "pagging": { "page": req.query.page, "page-total": Math.ceil(payload.length / req.query.limit) }, success: true } });
    });

})


app.post('/maps/:guid/rate/', (req, res) => {
    console.log("Body:", req.body);
    res.status(200).json({ success: true });
})

app.get('/maps/:guid/remove/', express.urlencoded({ extended: false }), badTokenAuthv2, (req, res) => {
    console.log("req sent to /maps/:guid/remove/ for guid:", req.params.guid)
    const uid = req.uid
    db.get(`SELECT player_id FROM communitytracks WHERE guid = ?`, [req.params.guid], (err, row) => {
        if (err || !row) {
            console.error("Error fetching drone:", err);
            res.status(500).json({ success: false });
            return;
        } else {
            if (row.player_id == uid) {
                db.run(`DELETE FROM communitytracks WHERE guid = ? AND player_id = ?`, [req.params.guid, uid], function (err) {
                    if (err) {
                        console.error("Error deleting community track:", err);
                        res.status(500).json({ success: false });
                        return;
                    } else {
                        console.log(`Deleted ${this.changes} row(s) from community tracks table.`);
                        res.status(200).json({ success: true });
                    }
                });
            } else {
                res.status(403).json({ success: false });
                return;
            }
        }
    });
});


app.get('/maps/:guid', (req, res) => {
    console.log("req sent to /maps/ for guid:", req.params.guid)
    db.get(`SELECT c.*,
                COALESCE(p.player_id, c.player_id) AS player_id,
                COALESCE(p.profile_name, c.profile_name) AS profile_name,
                COALESCE(p.profile_photo_url, c.profile_thumb) AS profile_thumb,
                COALESCE(p.profile_color, c.profile_color) AS profile_color,
                t.root AS root
                
                FROM communitytracks c LEFT JOIN profilestatemodel p ON p.player_id = c.player_id LEFT JOIN trackroots t ON t.guid = c.guid WHERE c.guid = ?`, [req.params.guid], (err, row) => {
        if (err) {
            console.error("Error fetching community track:", err);
            return res.status(500).json({ success: false });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: "Track not found" });
        }
        const trackData = mapCTracksqlToJson(row);
        res.status(200).json({ success: true, data: { pagging: { page: 1, "page-total": 1 }, data: [trackData] } });
    });
});

app.get('/maps/', (req, res) => {
    console.log("req sent to /maps/ headers are:", req.headers, req.query);

    const mapCategories = req.query['map-category'] ? Array.isArray(req.query['map-category']) ? req.query['map-category'] : [req.query['map-category']] : ['MapCommon'];
    const isRaceAllowed = req.query['is-race-allowed'];
    const isPublic = req.query['is-public'];

    const limit = parseInt(req.query.limit) || 6;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    let sqlSort = "";
    let filters = []
    let filtersP = []

    let Order = []
    let OrderP = []

    if (req.query['map-difficulty']) {
        filters.push(`map_difficulty = ?`);
        filtersP.push(parseInt(req.query['map-difficulty']));
    }
    if (req.query['map-id']) {
        filters.push("map_id = ?");
        filtersP.push(req.query['map-id']);
    }
    if (req.query.guid) {
        filters.push("guid = ?");
        filtersP.push(req.query.guid);
    } else if (req.query['player-id']) {
        filters.push("c.player_id = ?")
        filtersP.push(req.query['player-id']);
    } else {
        const placeholders = mapCategories.map(() => '?').join(',');
        filters.push(`map_category IN (${placeholders})`);
        filtersP.push(...mapCategories);

        filters.push("is_race_allowed = ?");
        filtersP.push(isRaceAllowed === 'true' || 1);

        filters.push("is_public = ?");
        filtersP.push(isPublic === 'true' || 1);
    }
    if (req.query.q) {
        if (req.query.q.startsWith("@")) {
            filters.push("COALESCE(p.profile_name, c.profile_name) = ?");
            filtersP.push(req.query.q.toLowerCase().substring(1));
        } else {
            filters.push("map_title LIKE ?");
            filtersP.push(`%${req.query.q}%`);
        }
    }
    if (req.query.sort && req.query.order) {
        const normalizedSort = req.query.sort.replace(/-/g, '_');
        const allowedSortFields = ['score', 'rating_count', 'created_at', 'updated_at'];
        const sortField = allowedSortFields.includes(normalizedSort) ? normalizedSort : 'score';

        const sortOrder = req.query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        sqlSort = `ORDER BY ${sortField} ${sortOrder}`;
        Order.push(sqlSort)
    }

    console.log("Final filters:", filters);
    console.log("Final filter parameters:", filtersP);


    db.get(
        `SELECT COUNT(*) as total FROM communitytracks c LEFT JOIN profilestatemodel p ON p.player_id = c.player_id WHERE ${filters.join(' AND ')}`,
        [...filtersP],
        (err, countResult) => {
            if (err) {
                console.error("Error counting tracks:", err);
                return res.status(500).json({ success: false });
            }
            const totalCount = countResult.total;
            const totalPages = Math.ceil(totalCount / limit);
            db.all(
                `SELECT c.*,
                COALESCE(p.player_id, c.player_id) AS player_id,
                COALESCE(p.profile_name, c.profile_name) AS profile_name,
                COALESCE(p.profile_photo_url, c.profile_thumb) AS profile_thumb,
                COALESCE(p.profile_color, c.profile_color) AS profile_color
                
                FROM communitytracks c LEFT JOIN profilestatemodel p ON p.player_id = c.player_id WHERE ${filters.join(' AND ')} ${Order.join('')} LIMIT ? OFFSET ? `,
                [...filtersP, limit, offset],
                (err, rows) => {
                    if (err) {
                        console.error("Error fetching community tracks:", err);
                        return res.status(500).json({ success: false });
                    }
                    const payload = rows.map(row => mapCTracksqlToJson(row));
                    res.status(200).json({ success: true, data: { data: payload, pagging: { page: page, "page-total": totalPages } } });
                    console.log("Returned", payload.length, "tracks for page", page, "of", totalPages);
                }
            );
        }
    );
});

app.post('/maps/', express.urlencoded({ limit: "100mb", extended: true }), rateLimit({ windowMs: 60_000, max: 120 }), badTokenAuthv2, (req, res) => {
    console.log("req sent to /maps/ via POST", req.body);
    if (req.body.prefs === '{}') {
        req.body.prefs = { "map-prefs-auto-save": true }
    }
    const track = req.body;
    console.log(track.prefs)
    const uid = req.uid
    db.get(`SELECT json FROM playerstate WHERE uid = ?`, [uid], (err, row) => {
        if (!row) {
            return res.status(500).json({ success: false, error: 'Player state not found' });
        }
        let jsondata = JSON.parse(row.json);
        let root = {
            "id": req.body.root.id,
            "children": [],
            "type": req.body.root.type,
            "name": "$root"
        }
        db.run(`INSERT INTO communitytracks (
            guid,
            root,
            root_full,
            prefs,
            allow_copy,
            base_assets_enabled,
            exclusive_by_platform,
            is_race_allowed,
            is_public,
            is_public_for_drlpilots,
            is_drl_official,
            is_featured,
            is_multigp,
            is_tryouts,
            is_virtual_season,
            map_category,
            map_difficulty,
            map_distance,
            map_dirty,
            map_lighting,
            map_laps,
            map_stats_triangle_count,
            map_stats_object_count,
            map_asset_layers,
            map_styles,
            categories,
            prefs_auto_save,
            rating_count,
            score,
            track_id,
            xp_value,
            xp_min_time,
            cm_collectable_count,
            collaborators,
            map_mode_type,
            map_id,
            map_title,
            steam_id,
            created_at,
            updated_at,
            version,
            title_translations,
            images,
            map_thumb,
            avatar,
            player_id,
            profile_name,
            profile_thumb,
            profile_color,
            profile_platform,
            profile_platform_id,
            flag_url,
            is_avatar_blocked,
            full_track_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guid) DO UPDATE SET
            root = excluded.root,
            root_full = excluded.root_full,
            prefs = excluded.prefs,
            allow_copy = excluded.allow_copy,
            base_assets_enabled = excluded.base_assets_enabled,
            exclusive_by_platform = excluded.exclusive_by_platform,
            is_race_allowed = excluded.is_race_allowed,
            is_public = excluded.is_public,
            is_public_for_drlpilots = excluded.is_public_for_drlpilots,
            is_drl_official = excluded.is_drl_official,
            is_featured = excluded.is_featured,
            is_multigp = excluded.is_multigp,
            is_tryouts = excluded.is_tryouts,
            is_virtual_season = excluded.is_virtual_season,
            map_category = excluded.map_category,
            map_difficulty = excluded.map_difficulty,
            map_distance = excluded.map_distance,
            map_dirty = excluded.map_dirty,
            map_lighting = excluded.map_lighting,
            map_laps = excluded.map_laps,
            map_stats_triangle_count = excluded.map_stats_triangle_count,
            map_stats_object_count = excluded.map_stats_object_count,
            map_asset_layers = excluded.map_asset_layers,
            map_styles = excluded.map_styles,
            categories = excluded.categories,
            prefs_auto_save = excluded.prefs_auto_save,
            rating_count = excluded.rating_count,
            score = excluded.score,
            track_id = excluded.track_id,
            xp_value = excluded.xp_value,
            xp_min_time = excluded.xp_min_time,
            cm_collectable_count = excluded.cm_collectable_count,
            collaborators = excluded.collaborators,
            map_mode_type = excluded.map_mode_type,
            map_id = excluded.map_id,
            map_title = excluded.map_title,
            steam_id = excluded.steam_id,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            version = excluded.version,
            title_translations = excluded.title_translations,
            images = excluded.images,
            map_thumb = excluded.map_thumb,
            avatar = excluded.avatar,
            player_id = excluded.player_id,
            profile_name = excluded.profile_name,
            profile_thumb = excluded.profile_thumb,
            profile_color = excluded.profile_color,
            profile_platform = excluded.profile_platform,
            profile_platform_id = excluded.profile_platform_id,
            flag_url = excluded.flag_url,
            is_avatar_blocked = excluded.is_avatar_blocked,
            full_track_url = excluded.full_track_url`, [
            track.guid,
            JSON.stringify(root),
            JSON.stringify(track.root),
            JSON.stringify(track.prefs),
            track["allow-copy"],
            track["base-assets-enabled"],
            JSON.stringify(track["exclusive-by-platform"]),
            track["is-race-allowed"],
            track["is-public"],
            track["is-public-for-drlpilots"],
            track["is-drl-official"],
            track["is-featured"],
            track["is-multigp"],
            track["is-tryouts"],
            track["is-virtual-season"],
            track["map-category"],
            track["map-difficulty"],
            track["map-distance"],
            track["map-dirty"],
            track["map-lighting"],
            track["map-laps"],
            track["map-stats-triangle-count"],
            track["map-stats-object-count"],
            JSON.stringify(track["map-asset-layers"]),
            JSON.stringify(track["map-styles"]),
            JSON.stringify(track["categories"]),
            track["prefs-auto-save"],
            track["rating-count"],
            track["score"],
            track["track-id"],
            track["xp-value"],
            track["xp-min-time"],
            track["cm-collectable-count"],
            JSON.stringify(track["collaborators"]),
            track["map-mode-type"],
            track["map-id"],
            track["map-title"],
            track["steam-id"],
            track["created-at"],
            track["updated-at"],
            track["version"],
            JSON.stringify(track["title-translations"]),
            JSON.stringify(track["images"]),
            track["map-thumb"],
            track["avatar"],
            track["player-id"],
            track["profile-name"],
            track["profile-thumb"],
            track["profile-color"],
            track["profile-platform"],
            track["profile-platform-id"],
            track["flag-url"],
            track["is-avatar-blocked"],
            track["full-track-url"]
        ], err => {
            if (err) {
                console.error("Error inserting/updating community track:", err);
                res.status(500).json({ success: false });
                return;
            } else {
                if (req.body.collaborators) {
                    db.run(`INSERT OR IGNORE INTO trackcolab (uid, guid) VALUES (?, ?)`, [req.body['player-id'], req.body.guid], function (err) {
                        if (err) {
                            console.error("Error inserting into trackcolab:", err);
                        } else {

                            db.all(`SELECT * FROM trackcolab WHERE guid = ?`, [req.body.guid], (err, row) => {

                                const existingUids = row.map(r => r.uid);
                                console.log(req.body.collaborators)
                                const incomingUids = JSON.parse(req.body.collaborators).map(c => c['player-id']);

                                incomingUids.forEach(uid => {
                                    if (!existingUids.includes(uid)) {
                                        db.run(`INSERT INTO trackcolab (uid, guid) VALUES (?, ?)`, [uid, req.body.guid]);
                                    }
                                });

                                existingUids.forEach(uid => {
                                    if (!incomingUids.includes(uid)) {
                                        db.run(`DELETE FROM trackcolab WHERE uid = ? AND guid = ?`, [uid, req.body.guid]);
                                    }
                                });


                                res.status(200).json({ success: true, data: req.body });
                            });
                        }
                    });
                }
                else {
                    db.run(`INSERT OR IGNORE INTO trackcolab (uid, guid) VALUES (?, ?)`, [req.body['player-id'], req.body.guid], function (err) {
                        if (err) {
                            console.error("Error inserting into trackcolab:", err);
                        } else {
                            res.status(200).json({ success: true, data: req.body });
                        }
                    });
                }
            }
        })
    });
});


/*
---------------------------------------------------------------------------------------------------------
███████╗████████╗ ██████╗ ██████╗  █████╗  ██████╗ ███████╗    ███████╗████████╗██╗   ██╗███████╗███████╗
██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝ ██╔════╝    ██╔════╝╚══██╔══╝██║   ██║██╔════╝██╔════╝
███████╗   ██║   ██║   ██║██████╔╝███████║██║  ███╗█████╗      ███████╗   ██║   ██║   ██║█████╗  █████╗
╚════██║   ██║   ██║   ██║██╔══██╗██╔══██║██║   ██║██╔══╝      ╚════██║   ██║   ██║   ██║██╔══╝  ██╔══╝
███████║   ██║   ╚██████╔╝██║  ██║██║  ██║╚██████╔╝███████╗    ███████║   ██║   ╚██████╔╝██║     ██║
╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
---------------------------------------------------------------------------------------------------------
*/

app.post('/storage/logs/', (req, res) => {
    console.log("replay sent to /storage/logs/ here is data:", req.headers);
    console.log(req.query)
    res.status(200).json({ success: true });
})


app.post('/replay/', badTokenAuthv2, replay.single('replay-data'), (req, res) => {
    console.log("replay sent to /replay/ here is data:", req.headers);
    console.log(req.query)
    console.log(req.body)
    console.log(req.file)
    const uid = req.uid
    if (req.file.size === 0) {
        return res.status(200).json({ success: true, message: "File is empty" });
    }
    db.run(
        `UPDATE leaderboard
                    SET replay_url = ?
                    WHERE rowid = (
                        SELECT rowid
                        FROM leaderboard
                        WHERE player_id = ?
                        ORDER BY updated_at DESC
                        LIMIT 1
                    )`,
        ['/replay/' + uid + '/' + req.file.filename, uid],
        function (err) {

            if (err) {
                console.error(err);
                res.status(500).json({ success: false });
                return;
            }

            console.log('Rows updated:', this.changes);
            res.status(200).json({ success: true });
        }
    );
});


app.post('/storage/replay-cloud/', badTokenAuthv2,
    //replayCloud.single('file'), DONT SAVE THE FILE
    (req, res) => {
        console.log("replay sent to /storage/replay-cloud/ here is data:", req.headers);
        console.log(req.query)
        console.log(req.body);
        console.log(req.file);
        res.status(200).json({ success: true });
    })

app.post('/storage/image/', badTokenAuthv2, imageCloud.single('file'), (req, res) => {
    console.log("Image sent to /storage/image/ here is data:", req.headers);
    console.log(req.query)
    console.log(req.body);
    console.log(req.file);
    res.status(200).json({ success: true, data: "/" + req.file.path.replace(/\\/g, '/') });
})

app.get('/images/', async (req, res) => {
    console.log("Image requested from /images/");
    const { url, w, h } = req.query;
    console.log(req.query)
    if (url.startsWith("/image-cloud/")) {
        const baseDir = path.join(__dirname, 'image-cloud');
        const finalPath = path.resolve(baseDir, url.replace("/image-cloud/", ""));
        if (!finalPath.startsWith(baseDir)) {
            return res.status(403).send('Forbidden: Invalid path');
        }
        if (!fs.existsSync(finalPath)) {
            return res.status(404).end();
        }
        let transform = sharp(finalPath);
        if (w || h) {
            transform = transform.resize({
                width: w ? parseInt(w) : null,
                height: h ? parseInt(h) : null,
                fit: 'contain'
            });
        }
        transform.pipe(res);
    } else if (url.startsWith(url + "/image-cloud/")) {
        const baseDir = path.join(__dirname, 'image-cloud');
        const finalPath = path.resolve(baseDir, url.replace(url + "/image-cloud/", ""));
        if (!finalPath.startsWith(baseDir)) {
            return res.status(403).send('Forbidden: Invalid path');
        }
        if (!fs.existsSync(finalPath)) {
            return res.status(404).end();
        }
        let transform = sharp(finalPath);
        if (w || h) {
            transform = transform.resize({
                width: w ? parseInt(w) : null,
                height: h ? parseInt(h) : null,
                fit: 'contain'
            });
        }
        transform.pipe(res);
    }
});



//This would be how you do it normaly but the game wants it in a really odd way - see above
app.get('/image-cloud/:uid/:id', (req, res) => {
    console.log("/image-cloud")
    const baseDir = path.join(__dirname, 'image-cloud');
    const finalPath = path.resolve(baseDir, req.params.uid, path.basename(req.params.id));

    if (!finalPath.startsWith(baseDir)) {
        return res.status(403).send('Forbidden: Invalid path');
    }

    if (!fs.existsSync(finalPath)) {
        return res.status(404).end();
    }
    res.sendFile(finalPath);
});


app.get('/replay/:uid/:guid', (req, res) => {
    const baseDir = path.join(__dirname, 'replay');
    const finalPath = path.resolve(baseDir, req.params.uid, path.basename(req.params.guid));

    if (!finalPath.startsWith(baseDir)) {
        return res.status(403).send('Forbidden: Invalid path');
    }

    if (!fs.existsSync(finalPath)) {
        return res.status(404).end();
    }

    console.log("GETTING REPLAY FROM:", finalPath);
    res.sendFile(finalPath);
});






app.get(`/onboarding-bots-replays-v2/onboarding-bot-beginner.race`, (req, res) => {
    res.sendFile(path.join(__dirname, 'bots', '$cache-onboarding-replay-Beginner0.rpl.bytes'));
})

app.get(`/onboarding-bots-replays-v2/onboarding-bot-intermediate.race`, (req, res) => {
    res.sendFile(path.join(__dirname, 'bots', '$cache-onboarding-replay-Intermediate0.rpl.bytes'));
})

app.get(`/onboarding-bots-replays-v2/onboarding-bot-pro-1.race`, (req, res) => {
    res.sendFile(path.join(__dirname, 'bots', '$cache-onboarding-replay-Pro0.rpl.bytes'));
})

app.get(`/onboarding-bots-replays-v2/onboarding-bot-pro-2.race`, (req, res) => {
    res.sendFile(path.join(__dirname, 'bots', '$cache-onboarding-replay-Pro1.rpl.bytes'));
})

app.get(`/onboarding-bots-replays-v2/onboarding-bot-pro-3.race`, (req, res) => {
    res.sendFile(path.join(__dirname, 'bots', '$cache-onboarding-replay-Pro2.rpl.bytes'));
})


/*
---------------------------------------
██╗      ██████╗  ██████╗ ██╗███╗   ██╗
██║     ██╔═══██╗██╔════╝ ██║████╗  ██║
██║     ██║   ██║██║  ███╗██║██╔██╗ ██║
██║     ██║   ██║██║   ██║██║██║╚██╗██║
███████╗╚██████╔╝╚██████╔╝██║██║ ╚████║
╚══════╝ ╚═════╝  ╚═════╝ ╚═╝╚═╝  ╚═══╝
---------------------------------------
*/

app.post('/v2/login', express.urlencoded({ extended: false }), (req, res) => {
    console.log("POST /v2/login")
    let decToken;
    try {
        decToken = decryptDRL(req.body.token, "09e027edfde3212431a8758576807083", req.body.time.padStart(16, '0'));
    } catch (E) {
        console.error("Login Decryption failed:", E);
        res.status(400).json({ success: false });
        return
    }
    const responseData = {
        "player-id": decToken.uid,
        permissions: [],
        expires: Math.floor(Date.now() / 1000) + 3600
    };

    console.log(responseData)

    const base64Data = Buffer
        .from(JSON.stringify(responseData))
        .toString('base64');

    db.get(`SELECT expires FROM user WHERE uid = ?`, [decToken.uid], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        if (row && row.expires === -1) {
            console.error("Banned user tried to login:", decToken.uid);
            return res.status(401).json({ success: false, message: "Token banned" });
        }
        db.run(`INSERT INTO user (uid, token, expires) VALUES (?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                token = excluded.token,
                expires = CASE WHEN user.expires = -1 THEN -1 ELSE excluded.expires END;`,
            [decToken.uid, req.body.token, responseData.expires],
            (err) => {
                if (err) {
                    console.error("SQLite insert failed:", err);
                    return res.status(500).json({ success: false });
                }
                res.status(200).json({
                    success: true,
                    token: req.body.token,
                    data: base64Data
                });
            }
        );
    });
});

/*
-------------------------------------------------
██████╗ ██╗      █████╗ ██╗   ██╗███████╗██████╗
██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
██████╔╝██║     ███████║ ╚████╔╝ █████╗  ██████╔╝
██╔═══╝ ██║     ██╔══██║  ╚██╔╝  ██╔══╝  ██╔══██╗
██║     ███████╗██║  ██║   ██║   ███████╗██║  ██║
╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
-------------------------------------------------
*/

function MapPlayerStateTOJson(row) {
    try {
        let data = {
            "system-info": row.system_info,
            "player-id": row.player_id,
            "steam-id": row.steam_id,
            "xbuid": row.xbuid,
            "playstation-id": row.playstation_id,
            "branch-id": row.branch_id,
            "steam-install-path": row.steam_install_path,
            "steam-purchase-unix-seconds": row.steam_purchase_unix_seconds,
            "profile-name": row.profile_name,
            "profile-block-list": row.profile_block_list,
            "profile-developer": row.profile_developer === 1 ? true : false,
            "profile-reward-parts": row.profile_reward_parts,
            "profile-photo-url": row.profile_photo_url,
            "profile-photo-size": row.profile_photo_size,
            "profile-custom-photo-url": row.profile_custom_photo_url,
            "profile-steam-photo-url": row.profile_steam_photo_url,
            "profile-color": row.profile_color,
            "profile-language-iso": row.profile_language_iso,
            "profile-country-iso": row.profile_country_iso,
            "profile-full-name": row.profile_full_name,
            "profile-email": row.profile_email,
            "profile-age": row.profile_age,
            "profile-country": row.profile_country,
            "profile-gender": row.profile_gender,
            "profile-score": row.profile_score,
            "has-review": row.has_review,
            "prompt-review": row.prompt_review,
            "is-drl-pilot": row.is_drl_pilot,
            "fps-limit": row.fps_limit,
            "profile-watch-drl": row.profile_watch_drl,
            "profile-american-citizen": row.profile_american_citizen,
            "profile-experience-non-fpv": row.profile_experience_non_fpv,
            "profile-experience-non-fpv-years": row.profile_experience_non_fpv_years,
            "profile-experience-fpv": row.profile_experience_fpv,
            "profile-experience-fpv-years": row.profile_experience_fpv_years,
            "profile-experience-preference-fpv": row.profile_experience_preference_fpv,
            "profile-experience-real-life-racing": row.profile_experience_real_life_racing,
            "profile-experience-built-own-drone": row.profile_experience_built_own_drone,
            "profile-affiliation-multigp": row.profile_affiliation_multigp,
            "profile-affiliation-military": row.profile_affiliation_military,
            "profile-affiliation-ama": row.profile_affiliation_ama,
            "profile-polls": row.profile_polls,
            "profile-paywall-dismiss": row.profile_paywall_dismiss,
            "profile-physics-intro": row.profile_physics_intro,
            "profile-user-rank": row.profile_user_rank,
            "profile-data-completion": row.profile_data_completion,
            "profile-inventory": row.profile_inventory,
            "flight-time": row.flight_time,
            "reset-delay": row.reset_delay,
            "xbox-privacy-ugc-blocked": row.xbox_privacy_ugc_blocked,
            "ps4-privacy-ugc-blocked": row.ps4_privacy_ugc_blocked,
            "storage-replay-file-count": row.storage_replay_file_count,
            "storage-replay-memory-usage": row.storage_replay_memory_usage,
            "dmv-welcome-screen": row.dmv_welcome_screen,
            "dmv-total_time": row.dmv_total_time,
            "fcmode-active": row.fcmode_active,
            "fcmode-active-missions": row.fcmode_active_missions,
            "network-server-region": row.network_server_region,
            "network-connected-region": row.network_connected_region,
            "settings-controller-profiles": row.settings_controller_profiles,
            "settings-controller-profile-active-guid": row.settings_controller_profile_active_guid,
            "settings-controller-using-adapter": row.settings_controller_using_adapter,
            "settings-fc-profiles": row.settings_fc_profiles,
            "settings-fc-profile-active-guid": row.settings_fc_profile_active_guid,
            "settings-audio-volume-main": row.settings_audio_volume_main,
            "settings-audio-volume-music": row.settings_audio_volume_music,
            "settings-audio-volume-sfx": row.settings_audio_volume_sfx,
            "settings-audio-ui-enabled": row.settings_audio_ui_enabled,
            "settings-audio-motor-enabled": row.settings_audio_motor_enabled,
            "settings-graphics-resolution-x": row.settings_graphics_resolution_x,
            "settings-graphics-resolution-y": row.settings_graphics_resolution_y,
            "settings-graphics-fullscreen": row.settings_graphics_fullscreen,
            "settings-graphics-vsync": row.settings_graphics_vsync,
            "settings-graphics-fps-limit": row.settings_graphics_fps_limit,
            "settings-graphics-mode": row.settings_graphics_mode,
            "settings-graphics-exclusive-mode": row.settings_graphics_exclusive_mode,
            "settings-graphics-advanced-rendering": row.settings_graphics_advanced_rendering,
            "settings-graphics-quality": row.settings_graphics_quality,
            "settings-graphics-effects-quality": row.settings_graphics_effects_quality,
            "settings-graphics-details-quality": row.settings_graphics_details_quality,
            "settings-graphics-tier": row.settings_graphics_tier,
            "settings-graphics-post-processing": row.settings_graphics_post_processing,
            "settings-graphics-texture": row.settings_graphics_texture,
            "settings-graphics-antialias": row.settings_graphics_antialias,
            "settings-graphics-shadows": row.settings_graphics_shadows,
            "settings-graphics-ambient-occlusion": row.settings_graphics_ambient_occlusion,
            "settings-graphics-dof": row.settings_graphics_dof,
            "settings-graphics-motion-blur": row.settings_graphics_motion_blur,
            "settings-graphics-water-reflection": row.settings_graphics_water_reflection,
            "settings-graphics-brightness": row.settings_graphics_brightness,
            "settings-graphics-render-scale": row.settings_graphics_render_scale,
            "settings-game-race-path": row.settings_game_race_path,
            "settings-game-race-guide": row.settings_game_race_guide,
            "settings-game-gate-markers": row.settings_game_gate_markers,
            "settings-game-race-stats": row.settings_game_race_stats,
            "settings-game-race-fast_reset": row.settings_game_race_fast_reset,
            "settings-radio-noise": row.settings_radio_noise,
            "settings-game-race-auto-standings": row.settings_game_race_auto_standings,
            "settings-game-fps-warning": row.settings_game_fps_warning,
            "settings-game-controller-overlay": row.settings_game_controller_overlay,
            "settings-game-trails": row.settings_game_trails,
            "settings-battery-resistance-min": row.settings_battery_resistance_min,
            "settings-battery-resistance-max": row.settings_battery_resistance_max,
            "settings-battery-resistance": row.settings_battery_resistance,
            "settings-battery-capacity": row.settings_battery_capacity,
            "settings-game-trails-duration": row.settings_game_trails_duration,
            "settings-game-tuning-promode": row.settings_game_tuning_promode,
            "settings-game-lens-distortion": row.settings_game_lens_distortion,
            "settings-game-props-visibility": row.settings_game_props_visibility,
            "settings-game-arm-and-turtle": row.settings_game_arm_and_turtle,
            "settings-game-propwash": row.settings_game_propwash,
            "settings-game-crosshair": row.settings_game_crosshair,
            "settings-game-chat": row.settings_game_chat,
            "settings-game-damage": row.settings_game_damage,
            "settings-game-hotkeys": row.settings_game_hotkeys,
            "settings-game-crossplay": row.settings_game_crossplay,
            "settings-game-race-line-color": row.settings_game_race_line_color,
            "settings-game-check-point-color": row.settings_game_check_point_color,
            "settings-graphics-screen-space-reflection": row.settings_graphics_screen_space_reflection,
            "results-list": row.results_list,
            "campaigns-attempts-table": row.campaigns_attempts_table,
            "campaigns-regions-table": row.campaigns_regions_table,
            "campaigns-new-highscore-table": row.campaigns_new_highscore_table,
            "campaigns-terms-accept-table": row.campaigns_terms_accept_table,
            "campaigns-register-info-table": row.campaigns_register_info_table,
            "garage-rigs": row.garage_rigs,
            "garage-active-rig": row.garage_active_rig,
            "physics-tunes": row.physics_tunes,
            "physics-active-tune": row.physics_active_tune,
            "physics-tune-warning": row.physics_tune_warning,
            "settings-language": row.settings_language,
            "settings-notification-state-menu": row.settings_notification_state_menu,
            "settings-notification-state-ingame": row.settings_notification_state_ingame,
            "circuits-opponent-mode": row.circuits_opponent_mode,
            "circuits-opponent-difficulty": row.circuits_opponent_difficulty,
            "onboarding-started": row.onboarding_started,
            "onboarding-progress-beginner": row.onboarding_progress_beginner,
            "onboarding-progress-intermediate": row.onboarding_progress_intermediate,
            "onboarding-progress-pro": row.onboarding_progress_pro,
            "onboarding-progress-proMissions": row.onboarding_progress_proMissions,
            "onboarding-progress-steps-beginner": row.onboarding_progress_steps_beginner,
            "onboarding-progress-steps-intermediate": row.onboarding_progress_steps_intermediate,
            "onboarding-progress-steps-pro": row.onboarding_progress_steps_pro,
            "onboarding-clicked-mission": row.onboarding_clicked_mission,
            "onboarding-orientation": row.onboarding_orientation,
            "onboarding-sensitivity": row.onboarding_sensitivity,
            "maps-favorite": row.maps_favorite,
            "invalidate-settings-cache": row.invalidate_settings_cache,
            "clear-maps-cache": row.clear_maps_cache,
            "blocked-users": row.blocked_users,
            "is-observer": row.is_observer,
            "is-commentator": row.is_commentator
        }
        return Object.fromEntries(
            Object.entries(data).filter(([key, value]) => value != null)
        );
    } catch (E) {
        console.error("Error mapping tournament SQL to JSON:", E);
        return {};
    }
}

app.get('/social/profile/', badTokenAuthv2, (req, res) => {
    console.log("social profile header for:", req.query);
    const uid = req.uid
    let payload = []
    const epicIds = Array.isArray(req.query['epic-ids'])
        ? req.query['epic-ids']
        : (typeof req.query['epic-ids'] === 'string' ? [req.query['epic-ids']] : []);
    const steamIds = Array.isArray(req.query['steam-ids'])
        ? req.query['steam-ids']
        : (typeof req.query['steam-ids'] === 'string' ? [req.query['steam-ids']] : []);
    console.log(epicIds)
    if (epicIds.length > 0) {
        let marks = []
        for (let i = 0; i < epicIds.length; i++) {
            marks.push("?")
        }
        db.all(`SELECT * FROM profilestatemodel WHERE player_id IN (${marks.join(',')})`, [...epicIds], (err, rows) => {
            if (err || rows.length === 0) {
                console.log("epic_id faild with:", err)
            } else {
                for (let i = 0; i < epicIds.length; i++) {
                    if (rows[i].player_id === epicIds[i]) {
                        payload.push({
                            "platform-id": "epic-id",
                            "player-id": rows[i].player_id,
                            "profile-color": rows[i].profile_color,
                            "profile-name": rows[i].profile_name,
                            "username": rows[i].profile_name,
                            "profile-thumb": rows[i].profile_photo_url,
                            "has-game": true,
                        })
                    } else {
                        payload.push({
                            "has-game": false
                        })
                    }
                }
            }
        });
    }
    if (steamIds.length > 0) {
        let marks = []
        for (let i = 0; i < steamIds.length; i++) {
            marks.push("?")
        }
        db.all(`SELECT * FROM profilestatemodel WHERE steam_id IN (${marks.join(',')})`, [...steamIds], (err, rows) => {
            if (err || rows.length === 0) {
                console.log("steam_id faild with:", err)
            } else {
                for (let i = 0; i < steamIds.length; i++) {
                    if (rows[i].steam_id === steamIds[i]) {
                        payload.push({
                            "platform-id": "steam-id",
                            "player-id": rows[i].player_id,
                            "profile-color": rows[i].profile_color,
                            "profile-name": rows[i].profile_name,
                            "username": rows[i].profile_name,
                            "profile-thumb": rows[i].profile_photo_url,
                            "has-game": true,
                        })
                    } else {
                        payload.push({
                            "has-game": false
                        })
                    }
                }
            }
        });
    }
    console.log(payload)
    const base64Data = Buffer.from(JSON.stringify(payload)).toString('base64');
    res.status(200).json({
        success: true, data: base64Data
    });
})

app.get(`/player/avatar/:uid/`, (req, res) => {
    db.get(`SELECT profile_photo_url FROM profilestatemodel WHERE player_id = ?`, [req.params.uid], async (err, row) => {
        if (err || !row) {
            res.status(500).json({ success: false });
            return
        }
        const imageUrl = row.profile_photo_url;
        try {
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            res.set('Content-Type', response.headers.get('content-type'));
            res.send(buffer);
        } catch (error) {
            res.status(500).json({ success: false });
        }
    })
})

app.get('/state/game/', (req, res) => {
    const payload = { lastState: null };
    const base64Data = Buffer.from(JSON.stringify(payload)).toString('base64');
    res.status(200).json({ success: true, data: base64Data });
})

app.get('/state/', badTokenAuthv2, (req, res) => {
    const token = req.headers['x-access-jsonwebtoken'];
    console.log("req sent to /state/ TOKEN:", token);
    let jsondata;
    const uid = req.uid;
    console.log("UID:", uid);
    db.get(`SELECT * FROM profilestatemodel WHERE player_id = ?`, [uid], async (err, row) => {
        if (err) {
            console.error("Error fetching JSON:", err);
            res.status(500).json({ success: false });
            return;
        } else if (!row) {
            console.log("No player state found for UID:", uid);
            jsondata = { lastState: null };
            const base64Data = Buffer.from(JSON.stringify(jsondata)).toString('base64');
            res.status(200).json({ success: true, data: base64Data });
            return;
        }
        if (!row.profile_photo_url && row['steam_id'] != null) {
            const steamPic = await getSteamProfilePic(row['steam_id']);
            row.profile_photo_url = steamPic.full;
        } else if (!row.profile_photo_url || row.profile_photo_url == null) {
            row.profile_photo_url = "https://raw.githubusercontent.com/gysi/drl-leaderboard-app/refs/heads/main/frontend/src/assets/placeholder.png";
        }
        jsondata = MapPlayerStateTOJson(row)
        console.log(jsondata)

        const base64Data = Buffer
            .from(JSON.stringify(jsondata))
            .toString('base64');

        res.status(200).json({ success: true, data: base64Data });
    })
})

const STEAM_API_KEY = process.env.STEAM_API_KEY;

async function getSteamProfilePic(steamId) {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.response.players.length > 0) {
            const player = data.response.players[0];
            return {
                full: player.avatarfull
            };
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Error fetching Steam profile:', error);
    }
}

app.post('/state/', express.urlencoded(), badTokenAuthv2, (req, res) => {
    const token = req.headers['x-access-jsonwebtoken'];
    console.log("post sent to /state/ TOKEN:", token, req.headers);
    const uid = req.uid;
    req.body.state = JSON.parse(req.body.state)
    db.run(`INSERT INTO profilestatemodel  (
            system_info,
            player_id,
            steam_id,
            xbuid,
            playstation_id,
            branch_id,
            steam_install_path,
            steam_purchase_unix_seconds,
            profile_name,
            profile_block_list,
            profile_reward_parts,
            profile_photo_url,
            profile_photo_size,
            profile_custom_photo_url,
            profile_steam_photo_url,
            profile_color,
            profile_language_iso,
            profile_country_iso,
            profile_full_name,
            profile_email,
            profile_age,
            profile_country,
            profile_gender,
            profile_score,
            has_review,
            prompt_review,
            is_drl_pilot,
            fps_limit,
            profile_watch_drl,
            profile_american_citizen,
            profile_experience_non_fpv,
            profile_experience_non_fpv_years,
            profile_experience_fpv,
            profile_experience_fpv_years,
            profile_experience_preference_fpv,
            profile_experience_real_life_racing,
            profile_experience_built_own_drone,
            profile_affiliation_multigp,
            profile_affiliation_military,
            profile_affiliation_ama,
            profile_polls,
            profile_paywall_dismiss,
            profile_physics_intro,
            profile_user_rank,
            profile_data_completion,
            profile_inventory,
            flight_time,
            reset_delay,
            xbox_privacy_ugc_blocked,
            ps4_privacy_ugc_blocked,
            storage_replay_file_count,
            storage_replay_memory_usage,
            dmv_welcome_screen,
            dmv_total_time,
            fcmode_active,
            fcmode_active_missions,
            network_server_region,
            network_connected_region,
            settings_controller_profiles,
            settings_controller_profile_active_guid,
            settings_controller_using_adapter,
            settings_fc_profiles,
            settings_fc_profile_active_guid,
            settings_audio_volume_main,
            settings_audio_volume_music,
            settings_audio_volume_sfx,
            settings_audio_ui_enabled,
            settings_audio_motor_enabled,
            settings_graphics_resolution_x,
            settings_graphics_resolution_y,
            settings_graphics_fullscreen,
            settings_graphics_vsync,
            settings_graphics_fps_limit,
            settings_graphics_mode,
            settings_graphics_exclusive_mode,
            settings_graphics_advanced_rendering,
            settings_graphics_quality,
            settings_graphics_effects_quality,
            settings_graphics_details_quality,
            settings_graphics_tier,
            settings_graphics_post_processing,
            settings_graphics_texture,
            settings_graphics_antialias,
            settings_graphics_shadows,
            settings_graphics_ambient_occlusion,
            settings_graphics_dof,
            settings_graphics_motion_blur,
            settings_graphics_water_reflection,
            settings_graphics_brightness,
            settings_graphics_render_scale,
            settings_game_race_path,
            settings_game_race_guide,
            settings_game_gate_markers,
            settings_game_race_stats,
            settings_game_race_fast_reset,
            settings_radio_noise,
            settings_game_race_auto_standings,
            settings_game_fps_warning,
            settings_game_controller_overlay,
            settings_game_trails,
            settings_battery_resistance_min,
            settings_battery_resistance_max,
            settings_battery_resistance,
            settings_battery_capacity,
            settings_game_trails_duration,
            settings_game_tuning_promode,
            settings_game_lens_distortion,
            settings_game_props_visibility,
            settings_game_arm_and_turtle,
            settings_game_propwash,
            settings_game_crosshair,
            settings_game_chat,
            settings_game_damage,
            settings_game_hotkeys,
            settings_game_crossplay,
            settings_game_race_line_color,
            settings_game_check_point_color,
            settings_graphics_screen_space_reflection,
            results_list,
            campaigns_attempts_table,
            campaigns_regions_table,
            campaigns_new_highscore_table,
            campaigns_terms_accept_table,
            campaigns_register_info_table,
            garage_rigs,
            garage_active_rig,
            physics_tunes,
            physics_active_tune,
            physics_tune_warning,
            settings_language,
            settings_notification_state_menu,
            settings_notification_state_ingame,
            circuits_opponent_mode,
            circuits_opponent_difficulty,
            onboarding_started,
            onboarding_progress_beginner,
            onboarding_progress_intermediate,
            onboarding_progress_pro,
            onboarding_progress_proMissions,
            onboarding_progress_steps_beginner,
            onboarding_progress_steps_intermediate,
            onboarding_progress_steps_pro,
            onboarding_clicked_mission,
            onboarding_orientation,
            onboarding_sensitivity,
            maps_favorite,
            invalidate_settings_cache,
            clear_maps_cache,
            blocked_users,
            is_observer,
            is_commentator
        ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (player_id) DO UPDATE SET
            system_info = EXCLUDED.system_info,
            steam_id = EXCLUDED.steam_id,
            xbuid = EXCLUDED.xbuid,
            playstation_id = EXCLUDED.playstation_id,
            branch_id = EXCLUDED.branch_id,
            steam_install_path = EXCLUDED.steam_install_path,
            steam_purchase_unix_seconds = EXCLUDED.steam_purchase_unix_seconds,
            profile_name = EXCLUDED.profile_name,
            profile_block_list = EXCLUDED.profile_block_list,
            profile_reward_parts = EXCLUDED.profile_reward_parts,
            profile_photo_url = EXCLUDED.profile_photo_url,
            profile_photo_size = EXCLUDED.profile_photo_size,
            profile_custom_photo_url = EXCLUDED.profile_custom_photo_url,
            profile_steam_photo_url = EXCLUDED.profile_steam_photo_url,
            profile_color = EXCLUDED.profile_color,
            profile_language_iso = EXCLUDED.profile_language_iso,
            profile_country_iso = EXCLUDED.profile_country_iso,
            profile_full_name = EXCLUDED.profile_full_name,
            profile_email = EXCLUDED.profile_email,
            profile_age = EXCLUDED.profile_age,
            profile_country = EXCLUDED.profile_country,
            profile_gender = EXCLUDED.profile_gender,
            profile_score = EXCLUDED.profile_score,
            has_review = EXCLUDED.has_review,
            prompt_review = EXCLUDED.prompt_review,
            is_drl_pilot = EXCLUDED.is_drl_pilot,
            fps_limit = EXCLUDED.fps_limit,
            profile_watch_drl = EXCLUDED.profile_watch_drl,
            profile_american_citizen = EXCLUDED.profile_american_citizen,
            profile_experience_non_fpv = EXCLUDED.profile_experience_non_fpv,
            profile_experience_non_fpv_years = EXCLUDED.profile_experience_non_fpv_years,
            profile_experience_fpv = EXCLUDED.profile_experience_fpv,
            profile_experience_fpv_years = EXCLUDED.profile_experience_fpv_years,
            profile_experience_preference_fpv = EXCLUDED.profile_experience_preference_fpv,
            profile_experience_real_life_racing = EXCLUDED.profile_experience_real_life_racing,
            profile_experience_built_own_drone = EXCLUDED.profile_experience_built_own_drone,
            profile_affiliation_multigp = EXCLUDED.profile_affiliation_multigp,
            profile_affiliation_military = EXCLUDED.profile_affiliation_military,
            profile_affiliation_ama = EXCLUDED.profile_affiliation_ama,
            profile_polls = EXCLUDED.profile_polls,
            profile_paywall_dismiss = EXCLUDED.profile_paywall_dismiss,
            profile_physics_intro = EXCLUDED.profile_physics_intro,
            profile_user_rank = EXCLUDED.profile_user_rank,
            profile_data_completion = EXCLUDED.profile_data_completion,
            profile_inventory = EXCLUDED.profile_inventory,
            flight_time = EXCLUDED.flight_time,
            reset_delay = EXCLUDED.reset_delay,
            xbox_privacy_ugc_blocked = EXCLUDED.xbox_privacy_ugc_blocked,
            ps4_privacy_ugc_blocked = EXCLUDED.ps4_privacy_ugc_blocked,
            storage_replay_file_count = EXCLUDED.storage_replay_file_count,
            storage_replay_memory_usage = EXCLUDED.storage_replay_memory_usage,
            dmv_welcome_screen = EXCLUDED.dmv_welcome_screen,
            dmv_total_time = EXCLUDED.dmv_total_time,
            fcmode_active = EXCLUDED.fcmode_active,
            fcmode_active_missions = EXCLUDED.fcmode_active_missions,
            network_server_region = EXCLUDED.network_server_region,
            network_connected_region = EXCLUDED.network_connected_region,
            settings_controller_profiles = EXCLUDED.settings_controller_profiles,
            settings_controller_profile_active_guid = EXCLUDED.settings_controller_profile_active_guid,
            settings_controller_using_adapter = EXCLUDED.settings_controller_using_adapter,
            settings_fc_profiles = EXCLUDED.settings_fc_profiles,
            settings_fc_profile_active_guid = EXCLUDED.settings_fc_profile_active_guid,
            settings_audio_volume_main = EXCLUDED.settings_audio_volume_main,
            settings_audio_volume_music = EXCLUDED.settings_audio_volume_music,
            settings_audio_volume_sfx = EXCLUDED.settings_audio_volume_sfx,
            settings_audio_ui_enabled = EXCLUDED.settings_audio_ui_enabled,
            settings_audio_motor_enabled = EXCLUDED.settings_audio_motor_enabled,
            settings_graphics_resolution_x = EXCLUDED.settings_graphics_resolution_x,
            settings_graphics_resolution_y = EXCLUDED.settings_graphics_resolution_y,
            settings_graphics_fullscreen = EXCLUDED.settings_graphics_fullscreen,
            settings_graphics_vsync = EXCLUDED.settings_graphics_vsync,
            settings_graphics_fps_limit = EXCLUDED.settings_graphics_fps_limit,
            settings_graphics_mode = EXCLUDED.settings_graphics_mode,
            settings_graphics_exclusive_mode = EXCLUDED.settings_graphics_exclusive_mode,
            settings_graphics_advanced_rendering = EXCLUDED.settings_graphics_advanced_rendering,
            settings_graphics_quality = EXCLUDED.settings_graphics_quality,
            settings_graphics_effects_quality = EXCLUDED.settings_graphics_effects_quality,
            settings_graphics_details_quality = EXCLUDED.settings_graphics_details_quality,
            settings_graphics_tier = EXCLUDED.settings_graphics_tier,
            settings_graphics_post_processing = EXCLUDED.settings_graphics_post_processing,
            settings_graphics_texture = EXCLUDED.settings_graphics_texture,
            settings_graphics_antialias = EXCLUDED.settings_graphics_antialias,
            settings_graphics_shadows = EXCLUDED.settings_graphics_shadows,
            settings_graphics_ambient_occlusion = EXCLUDED.settings_graphics_ambient_occlusion,
            settings_graphics_dof = EXCLUDED.settings_graphics_dof,
            settings_graphics_motion_blur = EXCLUDED.settings_graphics_motion_blur,
            settings_graphics_water_reflection = EXCLUDED.settings_graphics_water_reflection,
            settings_graphics_brightness = EXCLUDED.settings_graphics_brightness,
            settings_graphics_render_scale = EXCLUDED.settings_graphics_render_scale,
            settings_game_race_path = EXCLUDED.settings_game_race_path,
            settings_game_race_guide = EXCLUDED.settings_game_race_guide,
            settings_game_gate_markers = EXCLUDED.settings_game_gate_markers,
            settings_game_race_stats = EXCLUDED.settings_game_race_stats,
            settings_game_race_fast_reset = EXCLUDED.settings_game_race_fast_reset,
            settings_radio_noise = EXCLUDED.settings_radio_noise,
            settings_game_race_auto_standings = EXCLUDED.settings_game_race_auto_standings,
            settings_game_fps_warning = EXCLUDED.settings_game_fps_warning,
            settings_game_controller_overlay = EXCLUDED.settings_game_controller_overlay,
            settings_game_trails = EXCLUDED.settings_game_trails,
            settings_battery_resistance_min = EXCLUDED.settings_battery_resistance_min,
            settings_battery_resistance_max = EXCLUDED.settings_battery_resistance_max,
            settings_battery_resistance = EXCLUDED.settings_battery_resistance,
            settings_battery_capacity = EXCLUDED.settings_battery_capacity,
            settings_game_trails_duration = EXCLUDED.settings_game_trails_duration,
            settings_game_tuning_promode = EXCLUDED.settings_game_tuning_promode,
            settings_game_lens_distortion = EXCLUDED.settings_game_lens_distortion,
            settings_game_props_visibility = EXCLUDED.settings_game_props_visibility,
            settings_game_arm_and_turtle = EXCLUDED.settings_game_arm_and_turtle,
            settings_game_propwash = EXCLUDED.settings_game_propwash,
            settings_game_crosshair = EXCLUDED.settings_game_crosshair,
            settings_game_chat = EXCLUDED.settings_game_chat,
            settings_game_damage = EXCLUDED.settings_game_damage,
            settings_game_hotkeys = EXCLUDED.settings_game_hotkeys,
            settings_game_crossplay = EXCLUDED.settings_game_crossplay,
            settings_game_race_line_color = EXCLUDED.settings_game_race_line_color,
            settings_game_check_point_color = EXCLUDED.settings_game_check_point_color,
            settings_graphics_screen_space_reflection = EXCLUDED.settings_graphics_screen_space_reflection,
            results_list = EXCLUDED.results_list,
            campaigns_attempts_table = EXCLUDED.campaigns_attempts_table,
            campaigns_regions_table = EXCLUDED.campaigns_regions_table,
            campaigns_new_highscore_table = EXCLUDED.campaigns_new_highscore_table,
            campaigns_terms_accept_table = EXCLUDED.campaigns_terms_accept_table,
            campaigns_register_info_table = EXCLUDED.campaigns_register_info_table,
            garage_rigs = EXCLUDED.garage_rigs,
            garage_active_rig = EXCLUDED.garage_active_rig,
            physics_tunes = EXCLUDED.physics_tunes,
            physics_active_tune = EXCLUDED.physics_active_tune,
            physics_tune_warning = EXCLUDED.physics_tune_warning,
            settings_language = EXCLUDED.settings_language,
            settings_notification_state_menu = EXCLUDED.settings_notification_state_menu,
            settings_notification_state_ingame = EXCLUDED.settings_notification_state_ingame,
            circuits_opponent_mode = EXCLUDED.circuits_opponent_mode,
            circuits_opponent_difficulty = EXCLUDED.circuits_opponent_difficulty,
            onboarding_started = EXCLUDED.onboarding_started,
            onboarding_progress_beginner = EXCLUDED.onboarding_progress_beginner,
            onboarding_progress_intermediate = EXCLUDED.onboarding_progress_intermediate,
            onboarding_progress_pro = EXCLUDED.onboarding_progress_pro,
            onboarding_progress_proMissions = EXCLUDED.onboarding_progress_proMissions,
            onboarding_progress_steps_beginner = EXCLUDED.onboarding_progress_steps_beginner,
            onboarding_progress_steps_intermediate = EXCLUDED.onboarding_progress_steps_intermediate,
            onboarding_progress_steps_pro = EXCLUDED.onboarding_progress_steps_pro,
            onboarding_clicked_mission = EXCLUDED.onboarding_clicked_mission,
            onboarding_orientation = EXCLUDED.onboarding_orientation,
            onboarding_sensitivity = EXCLUDED.onboarding_sensitivity,
            maps_favorite = EXCLUDED.maps_favorite,
            invalidate_settings_cache = EXCLUDED.invalidate_settings_cache,
            clear_maps_cache = EXCLUDED.clear_maps_cache,
            blocked_users = EXCLUDED.blocked_users,
            is_observer = EXCLUDED.is_observer,
            is_commentator = EXCLUDED.is_commentator;`,
        [
            req.body.state["system-info"],
            uid,
            req.body.state["steam-id"],
            req.body.state["xbuid"],
            req.body.state["playstation-id"],
            req.body.state["branch-id"],
            req.body.state["steam-install-path"],
            req.body.state["steam-purchase-unix-seconds"],
            req.body.state["profile-name"],
            req.body.state["profile-block-list"],
            req.body.state["profile-reward-parts"],
            req.body.state["profile-photo-url"],
            req.body.state["profile-photo-size"],
            req.body.state["profile-custom-photo-url"],
            req.body.state["profile-steam-photo-url"],
            req.body.state["profile-color"],
            req.body.state["profile-language-iso"],
            req.body.state["profile-country-iso"],
            req.body.state["profile-full-name"],
            req.body.state["profile-email"],
            req.body.state["profile-age"],
            req.body.state["profile-country"],
            req.body.state["profile-gender"],
            req.body.state["profile-score"],
            req.body.state["has-review"],
            req.body.state["prompt-review"],
            req.body.state["is-drl-pilot"],
            req.body.state["fps-limit"],
            req.body.state["profile-watch-drl"],
            req.body.state["profile-american-citizen"],
            req.body.state["profile-experience-non-fpv"],
            req.body.state["profile-experience-non-fpv-years"],
            req.body.state["profile-experience-fpv"],
            req.body.state["profile-experience-fpv-years"],
            req.body.state["profile-experience-preference-fpv"],
            req.body.state["profile-experience-real-life-racing"],
            req.body.state["profile-experience-built-own-drone"],
            req.body.state["profile-affiliation-multigp"],
            req.body.state["profile-affiliation-military"],
            req.body.state["profile-affiliation-ama"],
            req.body.state["profile-polls"],
            req.body.state["profile-paywall-dismiss"],
            req.body.state["profile-physics-intro"],
            req.body.state["profile-user-rank"],
            req.body.state["profile-data-completion"],
            req.body.state["profile-inventory"],
            req.body.state["flight-time"],
            req.body.state["reset-delay"],
            req.body.state["xbox-privacy-ugc-blocked"],
            req.body.state["ps4-privacy-ugc-blocked"],
            req.body.state["storage-replay-file-count"],
            req.body.state["storage-replay-memory-usage"],
            req.body.state["dmv-welcome-screen"],
            req.body.state["dmv-total_time"],
            req.body.state["fcmode-active"],
            req.body.state["fcmode-active-missions"],
            req.body.state["network-server-region"],
            req.body.state["network-connected-region"],
            req.body.state["settings-controller-profiles"],
            req.body.state["settings-controller-profile-active-guid"],
            req.body.state["settings-controller-using-adapter"],
            req.body.state["settings-fc-profiles"],
            req.body.state["settings-fc-profile-active-guid"],
            req.body.state["settings-audio-volume-main"],
            req.body.state["settings-audio-volume-music"],
            req.body.state["settings-audio-volume-sfx"],
            req.body.state["settings-audio-ui-enabled"],
            req.body.state["settings-audio-motor-enabled"],
            req.body.state["settings-graphics-resolution-x"],
            req.body.state["settings-graphics-resolution-y"],
            req.body.state["settings-graphics-fullscreen"],
            req.body.state["settings-graphics-vsync"],
            req.body.state["settings-graphics-fps-limit"],
            req.body.state["settings-graphics-mode"],
            req.body.state["settings-graphics-exclusive-mode"],
            req.body.state["settings-graphics-advanced-rendering"],
            req.body.state["settings-graphics-quality"],
            req.body.state["settings-graphics-effects-quality"],
            req.body.state["settings-graphics-details-quality"],
            req.body.state["settings-graphics-tier"],
            req.body.state["settings-graphics-post-processing"],
            req.body.state["settings-graphics-texture"],
            req.body.state["settings-graphics-antialias"],
            req.body.state["settings-graphics-shadows"],
            req.body.state["settings-graphics-ambient-occlusion"],
            req.body.state["settings-graphics-dof"],
            req.body.state["settings-graphics-motion-blur"],
            req.body.state["settings-graphics-water-reflection"],
            req.body.state["settings-graphics-brightness"],
            req.body.state["settings-graphics-render-scale"],
            req.body.state["settings-game-race-path"],
            req.body.state["settings-game-race-guide"],
            req.body.state["settings-game-gate-markers"],
            req.body.state["settings-game-race-stats"],
            req.body.state["settings-game-race-fast_reset"],
            req.body.state["settings-radio-noise"],
            req.body.state["settings-game-race-auto-standings"],
            req.body.state["settings-game-fps-warning"],
            req.body.state["settings-game-controller-overlay"],
            req.body.state["settings-game-trails"],
            req.body.state["settings-battery-resistance-min"],
            req.body.state["settings-battery-resistance-max"],
            req.body.state["settings-battery-resistance"],
            req.body.state["settings-battery-capacity"],
            req.body.state["settings-game-trails-duration"],
            req.body.state["settings-game-tuning-promode"],
            req.body.state["settings-game-lens-distortion"],
            req.body.state["settings-game-props-visibility"],
            req.body.state["settings-game-arm-and-turtle"],
            req.body.state["settings-game-propwash"],
            req.body.state["settings-game-crosshair"],
            req.body.state["settings-game-chat"],
            req.body.state["settings-game-damage"],
            req.body.state["settings-game-hotkeys"],
            req.body.state["settings-game-crossplay"],
            req.body.state["settings-game-race-line-color"],
            req.body.state["settings-game-check-point-color"],
            req.body.state["settings-graphics-screen-space-reflection"],
            req.body.state["results-list"],
            req.body.state["campaigns-attempts-table"],
            req.body.state["campaigns-regions-table"],
            req.body.state["campaigns-new-highscore-table"],
            req.body.state["campaigns-terms-accept-table"],
            req.body.state["campaigns-register-info-table"],
            req.body.state["garage-rigs"],
            req.body.state["garage-active-rig"],
            req.body.state["physics-tunes"],
            req.body.state["physics-active-tune"],
            req.body.state["physics-tune-warning"],
            req.body.state["settings-language"],
            req.body.state["settings-notification-state-menu"],
            req.body.state["settings-notification-state-ingame"],
            req.body.state["circuits-opponent-mode"],
            req.body.state["circuits-opponent-difficulty"],
            req.body.state["onboarding-started"],
            req.body.state["onboarding-progress-beginner"],
            req.body.state["onboarding-progress-intermediate"],
            req.body.state["onboarding-progress-pro"],
            req.body.state["onboarding-progress-proMissions"],
            req.body.state["onboarding-progress-steps-beginner"],
            req.body.state["onboarding-progress-steps-intermediate"],
            req.body.state["onboarding-progress-steps-pro"],
            req.body.state["onboarding-clicked-mission"],
            req.body.state["onboarding-orientation"],
            req.body.state["onboarding-sensitivity"],
            req.body.state["maps-favorite"],
            req.body.state["invalidate-settings-cache"],
            req.body.state["clear-maps-cache"],
            req.body.state["blocked-users"],
            req.body.state["is-observer"],
            req.body.state["is-commentator"]
        ], (err) => {
            if (err) {
                console.error("Error writing state:", err);
                res.status(500).json({ success: false });
                return;
            }
            res.status(200).json({ success: true });
        })
});

/*
---------------------------------------------------------------------------------------------------
████████╗ ██████╗ ██╗   ██╗██████╗ ███╗   ██╗ █████╗ ███╗   ███╗███████╗███╗   ██╗████████╗███████╗
╚══██╔══╝██╔═══██╗██║   ██║██╔══██╗████╗  ██║██╔══██╗████╗ ████║██╔════╝████╗  ██║╚══██╔══╝██╔════╝
   ██║   ██║   ██║██║   ██║██████╔╝██╔██╗ ██║███████║██╔████╔██║█████╗  ██╔██╗ ██║   ██║   ███████╗
   ██║   ██║   ██║██║   ██║██╔══██╗██║╚██╗██║██╔══██║██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║   ╚════██║
   ██║   ╚██████╔╝╚██████╔╝██║  ██║██║ ╚████║██║  ██║██║ ╚═╝ ██║███████╗██║ ╚████║   ██║   ███████║
   ╚═╝    ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝
---------------------------------------------------------------------------------------------------
*/

const QualsTimeMins = 10

const RoundTimeMaxMins = 90

var tournamentsMap = new Map();

var tournamentRoundScoring = {};
var tournamentMatchPlayerData = {};

var tournamentOverallPlayerData = {};

var TournamentMatchReplays = {};




async function loadTournamentOverallPlayerData() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM tournamentoverallplayerdata`, [], (err, matchPlayerData) => {
            if (err) {
                reject()
                throw console.error("Error loading tournament match player data:", err);
            }
            for (let i = 0; i < matchPlayerData.length; i++) {
                if (!tournamentOverallPlayerData[matchPlayerData[i].guid]) {
                    tournamentOverallPlayerData[matchPlayerData[i].guid] = [];
                }
                let players = tournamentsMap.get(matchPlayerData[i].guid).players;

                let data = {
                    "player-id": matchPlayerData[i].player_id,
                    "profile-name": players[matchPlayerData[i].player_id].profile_name,
                    "profile-thumb": players[matchPlayerData[i].player_id].profile_thumb,
                    "profile-color": players[matchPlayerData[i].player_id].profile_color,
                    points: matchPlayerData[i].points,
                    score: matchPlayerData[i].score,
                    score_total: matchPlayerData[i].score_total,
                    position: matchPlayerData[i].position,
                    total_wins: matchPlayerData[i].total_wins,
                    "is-winner": matchPlayerData[i].is_winner,
                    "is-winner-second": matchPlayerData[i].is_winner_second
                }
                tournamentOverallPlayerData[matchPlayerData[i].guid].push(data);
            }
            resolve()
        })
    })
}

function SaveTournamentOverallPlayerData() {
    for (const guid in tournamentOverallPlayerData) {
        const matches = tournamentOverallPlayerData[guid];

        for (const matchID in matches) {
            const PlayerData = matches[matchID];
            db.run(
                `INSERT INTO tournamentoverallplayerdata
                (guid, player_id, points, score, score_total, position, total_wins, is_winner, is_winner_second)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guid, player_id) DO UPDATE SET
                points = excluded.points,
                score = excluded.score,
                score_total = excluded.score_total,
                position = excluded.position,
                total_wins = excluded.total_wins,
                is_winner = excluded.is_winner,
                is_winner_second = excluded.is_winner_second`,
                [
                    guid,
                    PlayerData["player-id"],
                    PlayerData.points,
                    PlayerData.score,
                    PlayerData.score_total,
                    PlayerData.position,
                    PlayerData.total_wins,
                    PlayerData['is-winner'],
                    PlayerData['is-winner-second']
                ], (err) => {
                    if (err) {
                        console.error("Error saving tournament Overall player data:", err);
                    }
                });
        }
    }
}



async function loadTournamentMatchPlayerData() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM tournamentmatchplayerdata`, [], (err, matchPlayerData) => {
            if (err) {
                reject()
                throw console.error("Error loading tournament match player data:", err);
            }
            for (let i = 0; i < matchPlayerData.length; i++) {
                if (!tournamentMatchPlayerData[matchPlayerData[i].guid]) {
                    tournamentMatchPlayerData[matchPlayerData[i].guid] = {};
                }
                if (!tournamentMatchPlayerData[matchPlayerData[i].guid][matchPlayerData[i].matchID]) {
                    tournamentMatchPlayerData[matchPlayerData[i].guid][matchPlayerData[i].matchID] = [];
                }
                let players = tournamentsMap.get(matchPlayerData[i].guid).players;

                let data = {
                    "player-id": matchPlayerData[i].player_id,
                    "profile-name": players[matchPlayerData[i].player_id].profile_name,
                    "profile-thumb": players[matchPlayerData[i].player_id].profile_thumb,
                    "profile-color": players[matchPlayerData[i].player_id].profile_color,
                    points: matchPlayerData[i].points,
                    score: matchPlayerData[i].score,
                    score_total: matchPlayerData[i].score_total,
                    position: matchPlayerData[i].position,
                    total_wins: matchPlayerData[i].total_wins,
                    "is-winner": matchPlayerData[i].is_winner,
                    "is-winner-second": matchPlayerData[i].is_winner_second
                }
                tournamentMatchPlayerData[matchPlayerData[i].guid][matchPlayerData[i].matchID].push(data);
            }
            resolve()
        })
    })
}

function SaveTournamentMatchPlayerData() {
    for (const guid in tournamentMatchPlayerData) {
        const matches = tournamentMatchPlayerData[guid];

        for (const matchID in matches) {
            const PlayerData = matches[matchID];
            for (const player of PlayerData) {
                db.run(
                    `INSERT INTO tournamentmatchplayerdata
                    (guid, player_id, matchID, points, score, score_total, position, total_wins, is_winner, is_winner_second)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(matchID, guid, player_id) DO UPDATE SET
                    points = excluded.points,
                    score = excluded.score,
                    score_total = excluded.score_total,
                    position = excluded.position,
                    total_wins = excluded.total_wins,
                    is_winner = excluded.is_winner,
                    is_winner_second = excluded.is_winner_second`,
                    [
                        guid,
                        player["player-id"],
                        matchID,
                        player.points,
                        player.score,
                        player.score_total,
                        player.position,
                        player.total_wins,
                        player['is-winner'],
                        player['is-winner-second']
                    ], (err) => {
                        if (err) {
                            console.error("Error saving tournament match player data:", err);
                        }
                    });
            }
        }
    }
}
async function SaveTournamentRoundScoring() {
    for (const guid in tournamentRoundScoring) {
        const matches = tournamentRoundScoring[guid];

        for (const matchID in matches) {
            const scores = matches[matchID];

            for (const score of scores) {
                await db.run(
                    `INSERT INTO tournamentroundscoring
                    (guid, player_id, matchID, success, heat, score, points, status, position, crashes, race_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guid, player_id, heat, matchID) DO UPDATE SET
                    success = excluded.success,
                    heat = excluded.heat,
                    score = excluded.score,
                    points = excluded.points,
                    status = excluded.status,
                    position = excluded.position,
                    crashes = excluded.crashes,
                    race_id = excluded.race_id`,
                    [
                        guid,
                        score["player-id"],
                        matchID,
                        score.success,
                        score.heat,
                        score.score,
                        score.points || 0,
                        score.status,
                        score.position,
                        score.crashes,
                        score["race-id"]
                    ],
                    (err) => {
                        if (err) {
                            console.error("Error saving tournament round scoring:", err);
                        }
                    }
                );
            }
        }
    }
}

async function loadTournamentRoundScoring() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM tournamentroundscoring`, [], (err, scoreData) => {
            if (err) {
                reject()
                throw console.error("Error loading tournament match player data:", err);
            }
            for (let i = 0; i < scoreData.length; i++) {
                const row = {
                    guid: scoreData[i].guid,
                    "player-id": scoreData[i].player_id,
                    "match-id": scoreData[i].matchID,
                    crashes: scoreData[i].crashes,
                    score: scoreData[i].score,
                    status: scoreData[i].status,
                    success: scoreData[i].success === "Success",
                    heat: scoreData[i].heat,
                    "race-id": scoreData[i].race_id,
                    position: scoreData[i].position,
                };
                if (!tournamentRoundScoring[row.guid]) {
                    tournamentRoundScoring[row.guid] = {};
                }
                if (!tournamentRoundScoring[row.guid][row["match-id"]]) {
                    tournamentRoundScoring[row.guid][row["match-id"]] = [];
                }
                tournamentRoundScoring[row.guid][row["match-id"]].push(row);
            }
            resolve()
        })
    })
}

TournamentMan();

async function TournamentMan() {
    await LoadTournaments()
    await loadTournamentRoundScoring()
    await loadTournamentMatchPlayerData()
    await loadTournamentOverallPlayerData()
    update()
}

async function LoadTournaments() {
    const tournaments = await loadAllTournaments();
    for (const tournament of tournaments) {
        tournamentsMap.set(tournament.guid, tournament);
    }
    console.log(
        `Loaded ${tournamentsMap.size} tournaments`
    );
}

async function update() {
    const now = new Date();

    for (const tournament of tournamentsMap.values()) {
        try {
            console.log(`Trying to update ${tournament.guid}`)
            await updateTournament(tournament, now);
        }
        catch (err) {
            console.error(
                `[TournamentManager] Failed updating ${tournament.guid}`,
                err
            );
        }
    }

    setTimeout(update, 10000)
}


async function updateTournament(tournament, now) {

    if (new Date(tournament.register_end) >= now) {
        tournament.status = "idle"
    }

    if (tournament.status === "idle" && tournament.allow_new_registration === 0 && tournament.player_count < tournament.max_players) {
        tournament.allow_new_registration = 1;
    }

    if (tournament.status === "idle" && new Date(tournament.register_end) <= now) {
        tournament.allow_new_registration = 0;
        tournament.status = "active";
        tournament.rounds = await createTournamentRounds(tournament, tournament.player_count, "DRL")
    }


    if (tournament.status === "active" && tournament.player_count < 6) {
        tournament.status = "fail";
    }

    if (tournament.status === "active") {
        //tournament.rounds = await updateTournamentRounds(tournament.rounds, now, tournament.players, tournament.guid);
    }
    tournament.rounds = await updateTournamentRounds(tournament.rounds, now, tournament.players, tournament.guid);

    await saveTournament(tournament);
    await SaveTournamentRoundScoring();
    await SaveTournamentMatchPlayerData();
    await SaveTournamentOverallPlayerData();
}


function loadAllTournaments() {
    return new Promise((resolve, reject) => {
        const query = `
        SELECT t.*,
        COUNT(tr.uid) AS player_count,

        GROUP_CONCAT(tr.uid) AS player_ids,

        GROUP_CONCAT(COALESCE(p.profile_name, '')) AS profile_names,
        GROUP_CONCAT(COALESCE(p.profile_photo_url, '')) AS profile_photos,
        GROUP_CONCAT(COALESCE(p.profile_color, '')) AS profile_colors

    
        FROM tournaments t
        LEFT JOIN tournamentsregistered tr ON t.guid = tr.guid
        LEFT JOIN profilestatemodel p ON p.player_id = tr.uid
        GROUP BY t.guid
    `;

        db.all(query, [], (err, rows) => {
            if (err) return reject(err);

            db.all(` SELECT * FROM tournamentrounds ORDER BY guid, roundNumber ASC`, [], (err, roundRows) => {
                if (err) return reject(err);

                db.all(` SELECT * FROM tournamentroundmatches ORDER BY guid, roundNumber, id ASC`, [], (err, matchRows) => {
                    const roundsByTournament = {};
                    roundRows.forEach(round => {
                        if (!roundsByTournament[round.guid]) {
                            roundsByTournament[round.guid] = [];
                        }
                        round.matches = [];
                        roundsByTournament[round.guid].push(round);
                    });


                    const matchesByRound = {};
                    matchRows.forEach(match => {
                        const key = `${match.guid}_${match.roundNumber}`;
                        if (!matchesByRound[key]) {
                            matchesByRound[key] = [];
                        }
                        match.player_ids = TOJSON(match.player_ids)
                        matchesByRound[key].push(match);
                    });

                    roundRows.forEach(round => {
                        const key = `${round.guid}_${round.roundNumber}`;
                        round.matches = matchesByRound[key] || [];
                    });

                    const formattedRows = rows.map(tournament => {
                        if (tournament.player_ids) {
                            tournament.playerids = tournament.player_ids.split(',');
                        } else {
                            tournament.playerids = [];
                        }

                        const ids = tournament.player_ids
                            ? tournament.player_ids.split(',')
                            : [];

                        const names = tournament.profile_names
                            ? tournament.profile_names.split(',')
                            : [];

                        const photos = tournament.profile_photos
                            ? tournament.profile_photos.split(',')
                            : [];

                        const colors = tournament.profile_colors
                            ? tournament.profile_colors.split(',')
                            : [];

                        tournament.playerStuff = ids.map((id, i) => ({
                            player_id: id,
                            profile_name: names[i] || null,
                            profile_thumb: photos[i] || null,
                            profile_color: colors[i] || null
                        }));

                        tournament.players = {};

                        tournament.playerStuff.forEach(player => {
                            tournament.players[player.player_id] = player;
                        });

                        delete tournament.playerStuff;
                        delete tournament.player_ids;
                        delete tournament.profile_names;
                        delete tournament.profile_photos;
                        delete tournament.profile_colors;

                        tournament.rounds = roundsByTournament[tournament.guid] || [];

                        return tournament;
                    });
                    resolve(formattedRows);
                })
            })
        });
    });
}


function GetReplay(MatchId, RaceID, playerID, heat) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT replay_url FROM leaderboard WHERE match_id = ? AND race_id = ? AND player_id = ? AND heat = ?`, [MatchId, RaceID, playerID, heat], (err, row) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(row ? row.replay_url : null);
            }
        });
    });
}


async function updateTournamentMatchReplays(MatchId, guid) {
    if (!TournamentMatchReplays[guid]) {
        TournamentMatchReplays[guid] = {};
    }
    if (!TournamentMatchReplays[guid][MatchId]) {
        TournamentMatchReplays[guid][MatchId] = []
    }
    let Replaydata = []

    const ScoreingInfo = tournamentRoundScoring[guid]?.[MatchId] ? tournamentRoundScoring[guid][MatchId] : []

    ScoreingInfo.sort((a, b) => a.heat - b.heat)

    let lastheat = -1

    let ReplayDataPerHeat;
    for (let i = 0; i < ScoreingInfo.length; i++) {
        const playerScore = ScoreingInfo[i];
        if (playerScore.heat !== lastheat) {
            if (ReplayDataPerHeat && ReplayDataPerHeat.urls) {
                Replaydata.push(ReplayDataPerHeat)
            }
            ReplayDataPerHeat = {
                heat: playerScore.heat
            }
            lastheat = playerScore.heat
        }

        const replay = await GetReplay(MatchId, playerScore['race-id'], playerScore['player-id'], playerScore['heat'])

        if (replay) {
            if (!ReplayDataPerHeat.urls) {
                ReplayDataPerHeat.urls = "";
            }
            ReplayDataPerHeat.urls += url + replay + ";"
        }
    }

    if (ReplayDataPerHeat && ReplayDataPerHeat.urls) {
        Replaydata.push(ReplayDataPerHeat)
    }
    TournamentMatchReplays[guid][MatchId] = Replaydata;
}

async function updateTournamentMatch(Match, now, roundinfo, players, guid) {

    if (Match.end_at) {
        if (Match.status === "active" && new Date(Match.end_at) <= now) {
            Match.status = "complete"
        }
    }

    Match.start_at = roundinfo.start_at
    Match.end_at = roundinfo.end_at


    if (!tournamentMatchPlayerData[guid]) {
        tournamentMatchPlayerData[guid] = {};
    }

    if (!tournamentOverallPlayerData[guid]) {
        tournamentOverallPlayerData[guid] = [];
    }

    if (!tournamentMatchPlayerData[guid][Match.id] || tournamentMatchPlayerData[guid][Match.id].length === 0) {
        tournamentMatchPlayerData[guid][Match.id] = [];
        if (Match.player_ids) {
            for (const id of Match.player_ids) {
                tournamentMatchPlayerData[guid][Match.id].push(
                    {
                        "player-id": id,
                        "profile-name": players[id].profile_name,
                        "profile-thumb": players[id].profile_thumb,
                        "profile-color": players[id].profile_color,
                    })
            }
        }
    }

    if (tournamentMatchPlayerData[guid][Match.id]) {

        if (Match.mode === "leaderboard") {

            tournamentMatchPlayerData[guid][Match.id].sort((a, b) => {
                if (a.score && b.score)
                    return a.score - b.score;
                else if (a.score)
                    return -1
                else if (b.score)
                    return 1

                return 0;
            });

            for (let i = 0; i < tournamentMatchPlayerData[guid][Match.id].length; i++) {
                tournamentMatchPlayerData[guid][Match.id][i].position = i + 1;
                if (tournamentMatchPlayerData[guid][Match.id][i].position <= Match.num_winners && tournamentMatchPlayerData[guid][Match.id][i].score > -1) {
                    tournamentMatchPlayerData[guid][Match.id][i]['is-winner'] = true;
                } else {
                    tournamentMatchPlayerData[guid][Match.id][i]['is-winner'] = false;
                }
            }
        } else if (Match.mode === "sudden_death") {

            tournamentMatchPlayerData[guid][Match.id].sort((a, b) => {
                return b.total_wins - a.total_wins;
            })

            for (let i = 0; i < tournamentMatchPlayerData[guid][Match.id].length; i++) {
                tournamentMatchPlayerData[guid][Match.id][i].position = i + 1;
                if (tournamentMatchPlayerData[guid][Match.id][i].position <= Match.num_winners && tournamentMatchPlayerData[guid][Match.id][i].total_wins > 0) {
                    tournamentMatchPlayerData[guid][Match.id][i]['is-winner'] = true;
                } else {
                    tournamentMatchPlayerData[guid][Match.id][i]['is-winner'] = false;
                }
            }

        } else if (Match.mode === "golden_heat") {
            for (let i = 0; i < tournamentMatchPlayerData[guid][Match.id].length; i++) {
                tournamentMatchPlayerData[guid][Match.id][i].position = i + 1;
                if (tournamentMatchPlayerData[guid][Match.id][i].total_wins > 0) {
                    tournamentMatchPlayerData[guid][Match.id][i]['is-winner'] = true;
                }
            }
            if (Match.active_heat === Match.heats) {
                Match.status = "complete"
            }
            if (tournamentRoundScoring[guid]?.[Match.id]) {
                for (let i = 0; i < tournamentRoundScoring[guid][Match.id].length; i++) {
                    const playerScore = tournamentRoundScoring[guid][Match.id][i];
                    if (playerScore.heat === Match.heats) {
                        const existingPlayer = tournamentOverallPlayerData[guid].find(p => p['player-id'] === playerScore['player-id']);
                        if (existingPlayer) {
                            existingPlayer.position = playerScore.position;
                        } else {
                            const playerinfo = tournamentMatchPlayerData[guid][Match.id].find(p => p['player-id'] === playerScore['player-id'])
                            playerinfo.position = playerScore.position
                            tournamentOverallPlayerData[guid].push(playerinfo)
                        }
                    }
                }
            }
        }
    }


    await updateTournamentMatchReplays(Match.id, guid)

    if (roundinfo.status === "active" && Match.status === "idle") {
        Match.status = "waiting"
    }
    return Match
}

async function SeedNextRound(CurrentRoundMatches, MatchesToSeed, guid) {
    let PlayerIdsToAdvance = []

    for (const Match of CurrentRoundMatches) {
        for (const Player of tournamentMatchPlayerData[guid][Match.id]) {
            if (Player['is-winner'] === true)
                PlayerIdsToAdvance.push(Player['player-id'])
        }
    }

    PlayerIdsToAdvance = await shuffle(PlayerIdsToAdvance)

    for (let i = 0; i < MatchesToSeed.length; i++) {
        MatchesToSeed[i].player_ids = PlayerIdsToAdvance.splice(0, MatchesToSeed[i].players_size)
        MatchesToSeed[i].status = "active"
    }

    return MatchesToSeed
}

async function updateTournamentRounds(rounds, now, players, guid) {
    let LastRoundStatus = "NoLastRound"

    for (i = 0; i < rounds.length; i++) {
        const round = rounds[i]

        if (LastRoundStatus === "NoLastRound" && round.status === "idle") {
            round.status = "active"
        }



        if (LastRoundStatus === "complete" && round.status === "active" && !round.start_at) {
            round.status = "active"
            round.start_at = new Date().toISOString()
            round.end_at = new Date(Date.now() + RoundTimeMaxMins * 60 * 1000).toISOString()
        }

        AllMatchesComplete = true
        for (let e = 0; e < round.matches.length; e++) {
            round.matches[e] = await updateTournamentMatch(round.matches[e], now, round, players, guid);
            if (round.matches[e].status !== "complete") {
                AllMatchesComplete = false;
            }
        }

        if (AllMatchesComplete) {
            round.status = "complete"
            if (i + 1 === rounds.length) {
                tournamentsMap.get(guid).status = "complete"
            } else {
                rounds[i + 1].matches = await SeedNextRound(round.matches, rounds[i + 1].matches, guid)
                rounds[i + 1].status = "active"
            }
        }

        if (round.end_at) {
            if (round.status === "active" && new Date(round.end_at) <= now && round.mode == "leaderboard") {
                round.status = "complete"
                rounds[i + 1].matches = await SeedNextRound(round.matches, rounds[i + 1].matches, guid)
                rounds[i + 1].status = "active"
            }
        }
        LastRoundStatus = round.status;
        rounds[i] = round;
    }

    return rounds
}



function createTournamentRounds(tournament, playerCount, tournamentType) {
    if (tournamentType === "DRL") {
        const rounds = [];
        let currentPlayers = playerCount;

        const targetBracketSize = currentPlayers > 24 ? 24 : (currentPlayers > 12 ? 12 : (currentPlayers > 6 ? 6 : 6));
        let roundNumber = 0;
        if (currentPlayers >= targetBracketSize) {
            rounds.push({
                status: "active",
                norder: 1,
                title: "QUALIFIERS",
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + QualsTimeMins * 60 * 1000).toISOString(),
                map: tournament.map,
                track: tournament.track,
                is_custom_map: tournament.is_custom_map,
                custom_map: tournament.custom_map,
                custom_map_title: tournament.custom_map_title,
                multiplayer_countdown: true,
                mode: "leaderboard",
                matches: [],
                roundId: "ROUND" + roundNumber,
                roundNumber: roundNumber,
                remainingPlayers: targetBracketSize
            });
            currentPlayers = targetBracketSize;
            roundNumber++;

            rounds[0].matches = createTournamentMatches(1, rounds[0], targetBracketSize, playerCount, tournament)
        }



        while (currentPlayers > 1) {
            const playersPerMatch = 6;
            const advancingPerMatch = currentPlayers <= 6 ? 1 : 3;

            const matchCount = Math.ceil(currentPlayers / playersPerMatch);
            const outgoingPlayers = matchCount * advancingPerMatch;

            let title
            let Matches = []
            let mode = "sudden_death"
            if (currentPlayers === 24)
                title = "QUARTERFINALS"
            else if (currentPlayers === 12) {
                title = "SEMIFINALS"
            } else if (currentPlayers === 6) {
                title = "FINALS"
                mode = "golden_heat"
            }

            rounds.push({
                title: title,
                incomingPlayers: currentPlayers,
                matchCount: matchCount,
                status: "idle",
                norder: 1 + roundNumber,
                start_at: null,
                end_at: null,
                map: tournament.map,
                track: tournament.track,
                is_custom_map: tournament.is_custom_map,
                custom_map: tournament.custom_map,
                custom_map_title: tournament.custom_map_title,
                multiplayer_countdown: true,
                mode: mode,
                timeout: 0,
                matches: [],
                roundId: "ROUND" + roundNumber,
                roundNumber: roundNumber,
                advancingPerMatch: advancingPerMatch,
                remainingPlayers: Math.min(outgoingPlayers, currentPlayers - 1)
            });

            rounds[roundNumber].matches = createTournamentMatches(matchCount, rounds[roundNumber], null, currentPlayers / matchCount);

            currentPlayers = advancingPerMatch === 1 ? 1 : outgoingPlayers;

            roundNumber++;
        }

        return rounds;
    }
}

function createTournamentMatches(matchCount, roundINFO, targetBracketSize, numberOfPlayers, tournament) {
    let matches = []
    for (i = 0; i < matchCount; i++) {
        if (roundINFO.title === "QUALIFIERS") {
            matches.push({
                id: "QUALS" + crypto.randomUUID(),
                round_id: roundINFO.roundId,
                round_norder: roundINFO.norder,
                map: roundINFO.map,
                track: roundINFO.track,
                is_custom_map: roundINFO.is_custom_map,
                custom_map: roundINFO.custom_map,
                custom_map_title: roundINFO.custom_map_title,
                multiplayer_room_timer: roundINFO.multiplayer_countdown,
                is_under_review: false,
                players_size: numberOfPlayers,
                throttle_cap: 0,
                heats: 4,
                current_heat: 1,
                active_heat: 0,
                num_winners: targetBracketSize,
                start_at: roundINFO.start_at,
                end_at: roundINFO.end_at,
                status: "active",
                player_ids: tournament.playerids,
                mode: roundINFO.mode
            })
        } else if (roundINFO.title === "QUARTERFINALS") {
            matches.push({
                id: "QUARTERFINALS" + crypto.randomUUID(),
                round_id: roundINFO.roundId,
                round_norder: roundINFO.norder,
                map: roundINFO.map,
                track: roundINFO.track,
                is_custom_map: roundINFO.is_custom_map,
                custom_map: roundINFO.custom_map,
                custom_map_title: roundINFO.custom_map_title,
                multiplayer_room_timer: roundINFO.multiplayer_countdown,
                is_under_review: false,
                players_size: numberOfPlayers,
                throttle_cap: 0,
                num_winners: 3,
                norder: i + 1,
                heats: 4,
                current_heat: 1,
                active_heat: 0,
                start_at: roundINFO.start_at,
                end_at: roundINFO.end_at,
                status: "idle",
                mode: roundINFO.mode
            })
        } else if (roundINFO.title === "SEMIFINALS") {
            matches.push({
                id: "SEMIFINALS" + crypto.randomUUID(),
                round_id: roundINFO.roundId,
                round_norder: roundINFO.norder,
                map: roundINFO.map,
                track: roundINFO.track,
                is_custom_map: roundINFO.is_custom_map,
                custom_map: roundINFO.custom_map,
                custom_map_title: roundINFO.custom_map_title,
                multiplayer_room_timer: roundINFO.multiplayer_countdown,
                is_under_review: false,
                players_size: numberOfPlayers,
                throttle_cap: 0,
                num_winners: 3,
                norder: i + 1,
                heats: 4,
                current_heat: 1,
                active_heat: 0,
                start_at: roundINFO.start_at,
                end_at: roundINFO.end_at,
                status: "idle",
                mode: roundINFO.mode
            })
        } else if (roundINFO.title === "FINALS") {
            matches.push({
                id: "FINALS" + crypto.randomUUID(),
                round_id: roundINFO.roundId,
                round_norder: roundINFO.norder,
                map: roundINFO.map,
                track: roundINFO.track,
                is_custom_map: roundINFO.is_custom_map,
                custom_map: roundINFO.custom_map,
                custom_map_title: roundINFO.custom_map_title,
                multiplayer_room_timer: roundINFO.multiplayer_countdown,
                is_under_review: false,
                players_size: numberOfPlayers,
                throttle_cap: 0,
                num_winners: 1,
                heats: 7,
                current_heat: 1,
                active_heat: 0,
                start_at: roundINFO.start_at,
                end_at: roundINFO.end_at,
                status: "idle",
                mode: roundINFO.mode
            })
        }
    }
    return matches
}

async function saveTournament(tournament) {

    db.run(
        `
                UPDATE tournaments
                SET
                    status = ?,
                    allow_new_registration = ?
                WHERE guid = ?
                `,
        [
            tournament.status,
            tournament.allow_new_registration,
            tournament.guid
        ],
        err => {
        }
    );

    if (tournament.rounds) {
        for (const round of tournament.rounds) {
            await saveRound(round, tournament);
            for (const match of round.matches) {
                await saveMatch(match, round, tournament)
            }
        }
    }
}


function saveMatch(Match, round, tournament) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO tournamentroundmatches (
            guid,
            roundNumber,
            id,
            round_id,
            round_norder,
            map,
            track,
            is_custom_map,
            custom_map,
            custom_map_title,
            multiplayer_room_timer,
            is_under_review,
            players_size,
            throttle_cap,
            current_heat,
            active_heat,
            status,
            norder,
            heats,
            num_winners,
            start_at,
            end_at,
            progress,
            default_drone_class,
            mode,
            parents,
            player_ids,
            player_order
            )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(roundNumber, guid, id) DO UPDATE SET
                round_id = excluded.round_id,
                round_norder = excluded.round_norder,
                map = excluded.map,
                track = excluded.track,
                is_custom_map = excluded.is_custom_map,
                custom_map = excluded.custom_map,
                custom_map_title = excluded.custom_map_title,
                multiplayer_room_timer = excluded.multiplayer_room_timer,
                is_under_review = excluded.is_under_review,
                players_size = excluded.players_size,
                throttle_cap = excluded.throttle_cap,
                current_heat = excluded.current_heat,
                active_heat = excluded.active_heat,
                status = excluded.status,
                norder = excluded.norder,
                heats = excluded.heats,
                num_winners = excluded.num_winners,
                start_at = excluded.start_at,
                end_at = excluded.end_at,
                progress = excluded.progress,
                default_drone_class = excluded.default_drone_class,
                mode = excluded.mode,
                parents = excluded.parents,
                player_ids = excluded.player_ids,
                player_order = excluded.player_order
        `, [
            tournament.guid,
            round.roundNumber,
            Match.id,
            Match.round_id,
            Match.round_norder,
            Match.map,
            Match.track,
            Match.is_custom_map,
            Match.custom_map,
            Match.custom_map_title,
            Match.multiplayer_room_timer,
            Match.is_under_review,
            Match.players_size,
            Match.throttle_cap,
            Match.current_heat,
            Match.active_heat,
            Match.status,
            Match.norder,
            Match.heats,
            Match.num_winners,
            Match.start_at,
            Match.end_at,
            Match.progress,
            Match.default_drone_class,
            Match.mode,
            Match.parents,
            JSON.stringify(Match.player_ids),
            Match.player_order,
        ], err => {
            if (err) {
                throw new Error(err)
                return reject(err)
            }

            resolve();
        })
    })
}

async function saveRound(round, tournament) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO tournamentrounds (guid, title, roundNumber, status, norder, start_at, end_at, map, track, is_custom_map, custom_map, custom_map_title, multiplayer_countdown, mode, timeout, roundId) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guid, roundNumber) DO UPDATE SET
                    title = excluded.title,
                    status = excluded.status,
                    norder = excluded.norder,
                    start_at = excluded.start_at,
                    end_at = excluded.end_at,
                    map = excluded.map,
                    track = excluded.track,
                    is_custom_map = excluded.is_custom_map,
                    custom_map = excluded.custom_map,
                    custom_map_title = excluded.custom_map_title,
                    multiplayer_countdown = excluded.multiplayer_countdown,
                    mode = excluded.mode,
                    timeout = excluded.timeout,
                    roundId = excluded.roundId
        `, [
            tournament.guid,
            round.title,
            round.roundNumber,
            round.status,
            round.norder,
            round.start_at,
            round.end_at,
            round.map,
            round.track,
            round.is_custom_map,
            round.custom_map,
            round.custom_map_title,
            round.multiplayer_countdown,
            round.mode,
            round.timeout,
            round.roundId
        ], err => {
            if (err)
                return reject(err)

            resolve();
        })
    })
}

function mapTournamentMatchSqlToJson(Match, guid) {
    let data = {
        id: Match.id,
        "round-id": Match.round_id,
        "round-norder": Match.round_norder,
        map: Match.map,
        track: Match.track,
        "is-custom-map": Match.is_custom_map,
        "custom-map": Match.custom_map,
        "custom-map-title": Match.custom_map_title,
        "multiplayer-room-timer": Match.multiplayer_room_timer == 1 ? true : false,
        "is-under-review": false,
        "players-size": Match.players_size,
        "throttle-cap": Match.throttle_cap,
        "heats": Match.heats,
        "current-heat": Match.current_heat,
        "active-heat": Match.active_heat,
        "start-at": Match.start_at,
        "end-at": Match.end_at,
        "current-time": new Date().toISOString(),
        "norder": Match.norder,
        "num-winners": Match.num_winners,
        status: Match.status,
        "player-ids": Match.player_ids,
        mode: Match.mode,
        players: tournamentMatchPlayerData[guid]?.[Match.id] ? tournamentMatchPlayerData[guid][Match.id] : [],
        "scores": tournamentRoundScoring[guid]?.[Match.id] ? tournamentRoundScoring[guid][Match.id] : [],
        "replay-urls": TournamentMatchReplays[guid]?.[Match.id] ? TournamentMatchReplays[guid][Match.id] : []
    }

    return Object.fromEntries(
        Object.entries(data).filter(([key, value]) => value != null)
    );
}

function mapTournamentsSqlToJson(row, playerids, player_count, ranking, rounds) {
    try {
        let data = {
            "id": row.id,
            "guid": row.guid,

            "title": row.title,
            "description": row.description,
            "call-to-action": row.call_to_action,
            "prize-description": row.prize_description,
            "prize-url": row.prize_url,
            "image-url": row.image_url,
            "video-url": row.video_url,
            "streaming-url": row.streaming_url,
            "terms-and-conditions-url": row.terms_and_conditions_url,

            "region": row.region,
            "players-size": row.player_count,
            "max-players": row.max_players,

            "current-time": new Date().toISOString(),
            "register-start": row.register_start,
            "register-end": row.register_end,

            "status": row.status,
            "type": row.type,

            "progression": row.progression,

            "allow-new-registration": row.allow_new_registration,

            "lan-support": row.lan_support,
            "server-ip": row.server_ip,

            "disable-public-spectators": row.disable_public_spectators,
            "private": row.private,

            "penalty": row.penalty,

            "drl-pilot-mode": row.drl_pilot_mode,
            "drone-guid": row.drone_guid,
            "default-drone-class": row.drone_class || 0,

            "countdown": row.countdown,

            "minimum-skill": row.minimum_skill,

            "age-check": row.age_check,

            "dawc-seeding": row.dawc_seeding,

            "age-check-number": row.age_check_number,

            "player-ids": playerids || [],
            "ranking": ranking || null,



            "automated": row.automated_tournament,
            "recurr-every-days": row.recurr_every_days,
            "map-pool": row.map_pool,
            "map": row.map,
            "track": row.track,
            "is-custom-map": row.is_custom_map,
            "custom-map": row.custom_map,
            "custom-map-title": row.custom_map_title
        }

        let Rounds = row.rounds
        let R = []
        if (Rounds) {
            Rounds.forEach(round => {
                let datas = {
                    "status": round.status,
                    "norder": round.norder,
                    "title": round.title,
                    "start-at": round.start_at,
                    "end-at": round.end_at,
                    "current-time": new Date().toISOString(),
                    "map": round.map,
                    "track": round.track,
                    "is-custom-map": round.is_custom_map,
                    "custom-map": round.custom_map,
                    "custom-map-title": round.custom_map_title,
                    "multiplayer-countdown": round.multiplayer_countdown == 1 ? true : false,
                    "mode": round.mode,
                    matches: []
                }

                let M = []
                if (round.matches) {
                    round.matches.forEach(Match => {
                        M.push(mapTournamentMatchSqlToJson(Match, row.guid));
                    });
                }
                datas.matches = M
                R.push(datas)
            });
        }

        data.rounds = R;

        return Object.fromEntries(
            Object.entries(data).filter(([key, value]) => value != null)
        );
    } catch (E) {
        console.error("Error mapping tournament SQL to JSON:", E);
        return {};
    }
}

app.get(`/tournaments/:guid/matches/:mid/heat/:hidx`, (req, res) => {
    let tournament = tournamentsMap.get(req.params.guid)


    const guid = req.params.guid
    const mid = req.params.mid
    const hidx = req.params.hidx

    let MatchScoring = tournamentRoundScoring[guid][mid]

    let HeatScores = []
    for (const score of MatchScoring) {
        if (score.heat == hidx) {
            score.username = tournament.players[score["player-id"]].profile_name
            score.color = tournament.players[score["player-id"]].profile_color
            HeatScores.push(score)
        }
    }
    res.status(200).json({
        success: true, data: {
            "results-arrived": HeatScores[0] ? true : false,
            results: HeatScores
        }
    });
})

app.get(`/tournaments/:guid/results/:roundid`, (req, res) => {
    const guid = req.params.guid

    let tournament = tournamentsMap.get(guid)

    if (!tournament)
        return res.status(404).json({ success: false })


    let found = tournament.rounds.find(m => m.roundId === req.params.roundid);


    if (!found)
        return res.status(404).json({ success: false })



    res.status(200).json({
        success: true, data: {
            "status": "success",
            "leaderboard-params": [
                { guid: guid, match: found.matches[0].id }
            ],
            "matches": [],
            "leaderboard": tournamentMatchPlayerData[guid]?.[found.matches[0].id] ? tournamentMatchPlayerData[guid][found.matches[0].id] : []
        }
    })
})


app.get('/tournaments/:guid/register', badTokenAuthv2, (req, res) => {
    console.log("/tournaments/:guid/register");
    const uid = req.uid;
    db.run(`INSERT INTO tournamentsregistered (uid, guid) VALUES (?, ?) ON CONFLICT (uid, guid) DO NOTHING`, [uid, req.params.guid], (err) => {
        if (err) {
            console.error("Error registering for tournament:", err);
            return res.status(500).json({ success: false })
        }
        LoadTournaments()
        res.status(200).json({ success: true });
    })
})


app.get('/tournaments/:guid/unregister', badTokenAuthv2, (req, res) => {
    console.log("/tournaments/:guid/register");
    const uid = req.uid;
    db.run(`DELETE FROM tournamentsregistered WHERE uid = ? AND guid = ?`, [uid, req.params.guid], (err) => {
        if (err) {
            console.error("Error unregister for tournament:", err);
            return res.status(500).json({ success: false })
        }
        LoadTournaments()
        res.status(200).json({ success: true });
    })
})

app.get(`/tournaments/:guid/matches/:mid/countdown`, (req, res) => {
    const base64Data = Buffer.from(JSON.stringify(true)).toString('base64');
    res.status(200).json({ success: true, data: base64Data });
})

app.get(`/tournaments/:guid/matches/:mid`, (req, res) => {
    console.log("/tournaments/:guid/matches/:mid")
    let tournament = tournamentsMap.get(req.params.guid)
    if (!tournament)
        return res.status(404).json({ success: false })

    let found = null;
    for (const round of tournament.rounds) {
        const match = round.matches.find(m => m.id === req.params.mid);
        if (match) {
            found = match
            break
        }
    }

    if (!found)
        return res.status(404).json({ success: false })

    res.status(200).json({ success: true, data: [mapTournamentMatchSqlToJson(found, req.params.guid)] });

})


app.post(`/tournaments/:guid/scores`, express.urlencoded({ extended: true }), badTokenAuthv2, (req, res) => {
    console.log("/tournaments/:guid/scores")
    let scoreData = JSON.parse(req.body.scores)
    if (scoreData.length === 0)
        return res.status(200).json({ success: true });

    const guid = req.params.guid;
    const MatchId = scoreData[0]["match-id"];
    const DataMode = scoreData[0].mode;


    if (!tournamentRoundScoring[guid]) {
        tournamentRoundScoring[guid] = {};
    }

    if (!tournamentRoundScoring[guid][MatchId])
        tournamentRoundScoring[guid][MatchId] = []

    if (!tournamentMatchPlayerData[guid]) {
        tournamentMatchPlayerData[guid] = {};
    }

    if (!tournamentMatchPlayerData[guid][MatchId]) {
        tournamentMatchPlayerData[guid][MatchId] = [];
    }




    scoreData.sort((a, b) => {
        if (a.status === b.status) {
            if (a.status === "Success") {
                return a.score - b.score;
            } else {
                return b.score - a.score;
            }
        }

        if (a.status === "Success") return -1;
        if (b.status === "Success") return 1;

        return b.score - a.score;
    });

    let FullData = [];
    for (let i = 0; i < scoreData.length; i++) {
        let data = {
            guid: guid,
            "player-id": scoreData[i]["player-id"],
            "match-id": scoreData[i]["match-id"],
            crashes: scoreData[i].crashes,
            score: scoreData[i].score,
            status: scoreData[i].status,
            success: scoreData[i].status === "Success",
            heat: scoreData[i].heat,
            "race-id": scoreData[i]["race-id"],
            position: i + 1
        }


        if (DataMode === "SinglePlayer") {

            let PlayerFound = false
            for (let e = 0; e < tournamentRoundScoring[guid][MatchId].length; e++) {
                if (tournamentRoundScoring[guid][MatchId][e]["player-id"] === scoreData[0]["player-id"] && tournamentRoundScoring[guid][MatchId][e].score < scoreData[0].score) {
                    return res.status(200).json({ success: true });
                } else if (tournamentRoundScoring[guid][MatchId][e]["player-id"] === scoreData[0]["player-id"]) {
                    tournamentRoundScoring[guid][MatchId][e] = data
                    PlayerFound = true
                    break;
                }
            }

            if (PlayerFound === false) {
                tournamentRoundScoring[guid][MatchId].push(data)
            }
        }

        for (let e = 0; e < tournamentMatchPlayerData[guid][MatchId].length; e++) {
            if (tournamentMatchPlayerData[guid][MatchId][e]["player-id"] === data["player-id"]) {
                if (DataMode === "NetworkMultiplayer" && i === 0)
                    tournamentMatchPlayerData[guid][MatchId][e].total_wins = (tournamentMatchPlayerData[guid][MatchId][e].total_wins || 0) + 1;

                if (DataMode === "NetworkMultiplayer" && i === 1 && tournamentMatchPlayerData[guid][MatchId][e]['is-winner-second'] !== true) {
                    tournamentMatchPlayerData[guid][MatchId][e]['is-winner-second'] = true;
                } else if (DataMode === "NetworkMultiplayer" && i === 1 && tournamentMatchPlayerData[guid][MatchId][e]['is-winner-second'] === true) {
                    tournamentMatchPlayerData[guid][MatchId][e]['is-winner'] = true;
                }

                tournamentMatchPlayerData[guid][MatchId][e].score = data.score;
                tournamentMatchPlayerData[guid][MatchId][e].crashes = data.crashes;
                tournamentMatchPlayerData[guid][MatchId][e].position = data.position;
                break;
            }

        }

        FullData.push(data)
    }


    if (DataMode === "NetworkMultiplayer") {
        tournamentRoundScoring[guid][MatchId].push(...FullData);


        let MatchData = null;
        let tournament = tournamentsMap.get(req.params.guid)
        for (let i = 0; i < tournament.rounds.length; i++) {
            for (let e = 0; e < tournament.rounds[i].matches.length; e++) {
                if (tournament.rounds[i].matches[e].id === MatchId) {
                    if (tournament.rounds[i].matches[e].heats > tournament.rounds[i].matches[e].current_heat) {
                        tournament.rounds[i].matches[e].current_heat++;
                        tournament.rounds[i].matches[e].active_heat++;
                    }else if (tournament.rounds[i].matches[e].active_heat < tournament.rounds[i].matches[e].heats) {
                        tournament.rounds[i].matches[e].active_heat++; // For the last round
                    } else {
                        console.log("marking match as complete")
                        tournament.rounds[i].matches[e].status = "complete";
                    }

                    MatchData = tournament.rounds[i].matches[e]
                    break;
                }
            }
        }
    }

    res.status(200).json({ success: true });
})



app.get(`/tournaments/:guid`, (req, res) => {
    const GUID = req.params.guid
    let tournament = tournamentsMap.get(GUID)
    tournament = mapTournamentsSqlToJson(tournament, tournament.playerids, tournament.player_count, tournamentOverallPlayerData[GUID] ? tournamentOverallPlayerData[GUID] : [], tournament.rounds);
    res.status(200).json({ success: true, data: [tournament] });
})

app.get('/tournaments/', (req, res) => {
    console.log("/tournaments/");
    const rows = Array.from(tournamentsMap.values(), row =>
        mapTournamentsSqlToJson(row)
    );
    res.status(200).json({ success: true, data: rows });
})

/*
-------------------------------------------------------------------------------------------------
██╗     ███████╗ █████╗ ██████╗ ███████╗██████╗ ██████╗  ██████╗  █████╗ ██████╗ ██████╗ ███████╗
██║     ██╔════╝██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝
██║     █████╗  ███████║██║  ██║█████╗  ██████╔╝██████╔╝██║   ██║███████║██████╔╝██║  ██║███████╗
██║     ██╔══╝  ██╔══██║██║  ██║██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║╚════██║
███████╗███████╗██║  ██║██████╔╝███████╗██║  ██║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝███████║
╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
-------------------------------------------------------------------------------------------------
*/

function mapLeaderboardSqlToJson(row, i) {
    return {
        "player-id": row[i].player_id,
        "id": crypto.createHash('sha256').update([row[i].player_id, row[i].map, row[i].track, row[i].diameter, row[i].drl_official, row[i].custom_map ?? "", row[i].match_id].join("|")).digest('hex'),
        "map": row[i].map,
        "track": row[i].track,
        "diameter": row[i].diameter,
        "drl-official": row[i].drl_official,
        "drone-name": row[i].drone_name,
        "drone-guid": row[i].drone_guid,
        "profile-platform-id": row[i].profile_platform_id,
        "username": row[i].profile_name,
        "profile-color": row[i].profile_color,
        "profile-thumb": row[i].profile_thumb || "https://raw.githubusercontent.com/gysi/drl-leaderboard-app/refs/heads/main/frontend/src/assets/placeholder.png",
        "profile-name": row[i].profile_name,
        "profile-platform": row[i].profile_platform,
        "is-custom-map": row[i].is_custom_map,
        "custom-map": row[i].custom_map,
        "mission": row[i].mission,
        "group-id": row[i].group_id,
        "region": row[i].region,
        "replay-url": url + row[i].replay_url,
        "game-type": row[i].game_type,
        "drone-thumb": row[i].drone_thumb,
        "multiplayer": row[i].multiplayer,
        "multiplayer-room-id": row[i].multiplayer_room_id,
        "multiplayer-room-size": row[i].multiplayer_room_size,
        "multiplayer-player-id": row[i].multiplayer_player_id,
        "multiplayer-master-id": row[i].multiplayer_master_id,
        "multiplayer-player-position": row[i].multiplayer_player_position,
        "flag-url": row[i].flag_url,
        "score-type": row[i].score_type,
        "match-id": row[i].match_id,
        "tryouts": row[i].tryouts,
        "battery-resistance": row[i].battery_resistance,
        "controller-type": row[i].controller_type,
        "position": i + 1,
        "score": row[i].score,
        "score-check": row[i].score_check,
        "score-double-check": row[i].score_double_check,
        "score-cheat": row[i].score_cheat,
        "score-cheat-ratio": row[i].score_cheat_ratio,
        "score-cheat-samples": row[i].score_cheat_samples,
        "crash-count": row[i].crash_count,
        "top-speed": row[i].top_speed,
        "time-in-first": row[i].time_in_first,
        "lap-times": TOJSON(row[i].lap_times),
        "gate-times": TOJSON(row[i].gate_times),
        "fastest-lap": row[i].fastest_lap,
        "slowest-lap": row[i].slowest_lap,
        "total-distance": row[i].total_distance,
        "percentile": row[i].percentile,
        "order-col": row[i].order_col,
        "high-score": row[i].high_score,
        "race-id": row[i].race_id,
        "limit-col": row[i].limit_col,
        "heat": row[i].heat,
        "custom-physics": row[i].custom_physics,
        "drl-pilot-mode": row[i].drl_pilot_mode,
        "drone-rig": row[i].drone_rig,
        "drone-hash": row[i].drone_hash,
        "created-at": normalizeDate(row[i].created_at),
        "updated-at": normalizeDate(row[i].updated_at)
    }
}

app.get('/onboarding/bots', badTokenAuthv2, (req, res) => {
    console.log('/onboarding/bots')
})

app.get('/onboarding/bots/beginner', badTokenAuthv2, (req, res) => {
    console.log('/onboarding/bots/beginner')
    res.sendFile("\bots\$cache-onboarding-replay-Beginner0.rpl.bytes")
})

app.get('/onboarding/bots/intermediate', badTokenAuthv2, (req, res) => {
    console.log('/onboarding/bots/intermediate')
})

app.get('/onboarding/pro', badTokenAuthv2, (req, res) => {
    console.log('/onboarding/pro')
})


//TODO: This
app.get('/leaderboards/user/', (req, res) => {
    const token = req.headers['x-access-jsonwebtoken']
    console.log(req.query)
    db.get(`SELECT uid, expires FROM user WHERE token = ?`, [token], (err, row) => {
        if (err || !row) {
            console.error("Error uid FROM user:", err);
            res.status(400).json({ success: false });
            return;
        }

    });
    let data = {
        leaderboard: [
            {
                playerId: "abc123",
                username: "PilotOne",
                platformPlayerId: "steam_001",
                score: 123456,
                position: 1,
                gameType: "Race",
                matchId: "match_001",
                map: "Desert",
                track: "TrackA",
                lapTimes: [40000, 41000, 39500],
                topSpeed: 98.5,
                timeInFirst: 120000,
                totalDistance: 1500,
                progression: null,
                "high-score": false,
                diameter: 7,
                "drl-official": true
            }
        ]
    };
    res.status(200).json({
        success: true, data: data
    });
});

app.post('/leaderboards/user/reset/', express.urlencoded({ extended: true }), badTokenAuthv2, (req, res) => {
    const uid = req.uid;
    fs.readdir("replay/" + uid, (err, files) => {
        if (err) {
            console.error(err)
            res.status(500).json({ success: false });
            return;
        }
        for (const file of files) {
            fs.unlink(path.join("replay/" + uid, file), (err) => {
                if (err) {
                    console.error(err)
                    res.status(500).json({ success: false });
                    return;
                }
            });
        }
        db.run(`DELETE FROM leaderboard WHERE player_id = ?`, [uid], function (err) {
            if (err) {
                res.status(500).json({ success: false });
                return;
            } else {
                res.status(200).json({ success: true });
                console.log(`Deleted ${this.changes} leaderboard entries for user ${uid}`);
            }
        });
    });
});

app.post('/leaderboards/user/reset/track/', express.urlencoded({ extended: true }), badTokenAuthv2, (req, res) => {
    console.log(req.body)
    let sql;
    let args;
    if (req.body.isCustom === 'true') {
        sql = `AND custom_map = ?`
        args = [uid, req.body.mapID, req.body.customMapId]
    } else {
        sql = `AND track = ?`
        args = [uid, req.body.mapID, req.body.trackID]
    }
    const uid = req.uid;
    db.run(`DELETE FROM leaderboard WHERE player_id = ? AND map = ?` + sql, args, function (err) {
        if (err) {
            res.status(500).json({ success: false });
        } else {
            res.status(200).json({ success: true });
            console.log(`Deleted ${this.changes} leaderboard entries for user ${uid}`);
        }
    });
});

app.post('/leaderboards/', express.urlencoded({ extended: false }), badTokenAuthv2, (req, res) => {
    console.log(TOJSON(req.body.list))
    console.log("NEW LEADERBOARD POST:")
    const parsed = TOJSON(req.body.list);
    db.all(`SELECT * FROM communitytracks WHERE guid = ?`, [parsed[0]['custom-map']], (err, Track) => {
        if (!parsed[0]["drl-official"]) {
            parsed[0]["drl-official"] = false
        }
        const Tracks = Track
        let highscore;
        const uid = req.uid;
        const diameter = Number(parsed[0].diameter);
        let query = ""
        let query1 = ""
        let inputs = []
        let inputs1 = []
        if (parsed[0]['is-custom-map'] == true) {
            query = `WHERE player_id = ? AND map = ? AND track = ? AND diameter = ? AND drl_official = ? AND custom_map = ? `
            query1 = `WHERE map = ? AND track = ? AND diameter = ? AND drl_official = ? AND custom_map = ? `
            inputs = [uid, parsed[0].map, parsed[0].track, diameter, parsed[0]["drl-official"], parsed[0]['custom-map']]
            inputs1 = [parsed[0].map, parsed[0].track, diameter, parsed[0]["drl-official"], parsed[0]['custom-map']]
        } else {
            query = `WHERE player_id = ? AND map = ? AND track = ? AND diameter = ? AND drl_official = ?`
            query1 = `WHERE map = ? AND track = ? AND diameter = ? AND drl_official = ?`
            inputs = [uid, parsed[0].map, parsed[0].track, diameter, parsed[0]["drl-official"]]
            inputs1 = [parsed[0].map, parsed[0].track, diameter, parsed[0]["drl-official"], parsed[0]['custom-map']]
        }
        console.log(`SELECT * FROM leaderboard ${query} `, inputs)

        db.get(`SELECT * FROM leaderboard ${query}`, inputs, (err, row) => {
            if (err || !row) {
                console.error("Error fetching leaderboard:", err);
            }

            const isNewRow = !row;
            let isBetterScore =
                row && row.score != null && parsed[0].score != null
                    ? parsed[0].score < row.score
                    : true;


            if (parsed[0].heat && parsed[0].heat > 0) {
                isBetterScore = true
            }

            if (parsed[0]['race-status'] && parsed[0]['race-status'] != "Success") {
                isBetterScore = false
            }
            console.log(parsed[0]['race-status'])
            if (isBetterScore || isNewRow) {
                if (!isNewRow) {
                    let rep = row.replay_url
                    let prefix = `/replay/${uid}/`
                    try {
                        if (rep.startsWith(prefix)) {
                            oldReplayfile = rep.substring(prefix.length)
                            fs.unlink(path.join("replay", uid, oldReplayfile), (err) => {
                                if (err) {
                                    console.error("Error deleting old replay file:", err);
                                }
                            });
                        }
                    } catch (e) {
                        console.log("No old replay")
                    }
                }
                const stmt = db.prepare(
                    `INSERT INTO leaderboard (player_id, profile_name, profile_color, map, track, is_custom_map, custom_map, mission, group_id, game_type, diameter, drone_name, drone_thumb, multiplayer, multiplayer_room_id, multiplayer_room_size, multiplayer_player_id, multiplayer_master_id, multiplayer_player_position, flag_url, score_type, match_id, tryouts, battery_resistance, controller_type, score, score_check, score_double_check, score_cheat, score_cheat_ratio, score_cheat_samples, crash_count, top_speed, time_in_first, lap_times, gate_times, fastest_lap, slowest_lap, total_distance, order_col, high_score, race_id, limit_col, heat, custom_physics, drl_official, drl_pilot_mode, drone_guid, drone_rig, drone_hash, race_status, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                                ON CONFLICT(player_id, map, track, diameter, drl_official, custom_map, match_id, race_status, heat) DO UPDATE SET score = excluded.score, score_check = excluded.score_check, score_double_check = excluded.score_double_check, controller_type = excluded.controller_type, score_cheat = excluded.score_cheat, score_cheat_ratio = excluded.score_cheat_ratio, score_cheat_samples = excluded.score_cheat_samples, crash_count = excluded.crash_count, top_speed = excluded.top_speed, lap_times = excluded.lap_times, gate_times = excluded.gate_times, fastest_lap = excluded.fastest_lap, slowest_lap = excluded.slowest_lap, total_distance = excluded.total_distance, race_id = excluded.race_id, drone_name = excluded.drone_name, drone_guid = excluded.drone_guid, updated_at = datetime('now');`
                );
                stmt.run(
                    uid,
                    req.body['profile-name'] || null,
                    req.body['profile-color'] || null,
                    parsed[0].map ? parsed[0].map : "unknown",
                    parsed[0].track ? parsed[0].track : "unknown",
                    parsed[0]['is-custom-map'] ? parsed[0]['is-custom-map'] : false,
                    parsed[0]['custom-map'] ? parsed[0]['custom-map'] : null,
                    parsed[0]['mission'] ? parsed[0]['mission'] : null,
                    parsed[0]['group-id'] ? parsed[0]['group-id'] : null,
                    parsed[0]['game-type'] ? parsed[0]['game-type'] : null,
                    parsed[0]['diameter'] ? parsed[0]['diameter'] : 7,
                    parsed[0]['drone-name'] ? parsed[0]['drone-name'] : null,
                    parsed[0]['drone-thumb'] ? parsed[0]['drone-thumb'] : null,
                    parsed[0]['multiplayer'] ? parsed[0]['multiplayer'] : null,
                    parsed[0]['multiplayer-room-id'] ? parsed[0]['multiplayer-room-id'] : null,
                    parsed[0]['multiplayer-room-size'] ? parsed[0]['multiplayer-room-size'] : null,
                    parsed[0]['multiplayer-player-id'] ? parsed[0]['multiplayer-player-id'] : null,
                    parsed[0]['multiplayer-master-id'] ? parsed[0]['multiplayer-master-id'] : null,
                    parsed[0]['multiplayer-player-position'] ? parsed[0]['multiplayer-player-position'] : null,
                    parsed[0]['flag-url'] ? parsed[0]['flag-url'] : null,
                    parsed[0]['score-type'] ? parsed[0]['score-type'] : null,
                    parsed[0]['match-id'] != null ? parsed[0]['match-id'] : 'normal',
                    parsed[0]['tryouts'] ? parsed[0]['tryouts'] : null,
                    parsed[0]['battery-resistance'] ? parsed[0]['battery-resistance'] : null,
                    parsed[0]['controller-type'] ? parsed[0]['controller-type'] : null,
                    parsed[0]['score'] ? parsed[0]['score'] : null,
                    parsed[0]['score-check'] ? parsed[0]['score-check'] : null,
                    parsed[0]['score-double-check'] ? parsed[0]['score-double-check'] : null,
                    parsed[0]['score-cheat'] ? parsed[0]['score-cheat'] : null,
                    parsed[0]['score-cheat-ratio'] ? parsed[0]['score-cheat-ratio'] : null,
                    parsed[0]['score-cheat-samples'] ? parsed[0]['score-cheat-samples'] : null,
                    parsed[0]['crash-count'] ? parsed[0]['crash-count'] : null,
                    parsed[0]['top-speed'] ? parsed[0]['top-speed'] : null,
                    parsed[0]['time-in-first'] ? parsed[0]['time-in-first'] : null,
                    parsed[0]['lap-times'] ? JSON.stringify(parsed[0]['lap-times']) : null,
                    parsed[0]['gate-times'] ? JSON.stringify(parsed[0]['gate-times']) : null,
                    parsed[0]['fastest-lap'] ? parsed[0]['fastest-lap'] : null,
                    parsed[0]['slowest-lap'] ? parsed[0]['slowest-lap'] : null,
                    parsed[0]['total-distance'] ? parsed[0]['total-distance'] : null,
                    parsed[0]['order-col'] ? parsed[0]['order-col'] : null,
                    parsed[0]['high-score'] ? parsed[0]['high-score'] : null,
                    parsed[0]['race-id'] ? parsed[0]['race-id'] : null,
                    parsed[0]['limit-col'] ? parsed[0]['limit-col'] : null,
                    parsed[0]['heat'] ? parsed[0]['heat'] : -1,
                    parsed[0]['custom-physics'] === true ? true : false,
                    parsed[0]['drl-official'] ? parsed[0]['drl-official'] : false,
                    parsed[0]['drl-pilot-mode'] ? parsed[0]['drl-pilot-mode'] : null,
                    parsed[0]['drone-guid'] ? parsed[0]['drone-guid'] : null,
                    parsed[0]['drone-rig'] ? parsed[0]['drone-rig'] : null,
                    parsed[0]['drone-hash'] ? parsed[0]['drone-hash'] : null,
                    parsed[0]['race-status'],
                    (err) => {

                        if (err) {
                            console.error("SQLite insert failed:", err);
                            return;
                        }

                        stmt.finalize(err => {
                            if (err) console.error("Error finalizing statement:", err);
                        });
                    });
                highscore = true
            } else {
                highscore = false
            }
            db.get(`SELECT * FROM playerprogression WHERE uid = ?`, [uid], (err, row) => {
                if (err || !row) {
                    console.error("Error fetching playerprogression:", err);
                    res.status(500).json({ success: false });
                    return;
                }
                let xpValue = 0
                console.log(Tracks)
                for (let i = 0; i < Tracks.length; i++) {
                    console.log(Tracks[i]['xp_value'])
                    if (Tracks[i].guid === parsed[0]['custom-map']) {
                        xpValue = Tracks[i]['xp_value'];
                    }
                }
                let NEWXP = row.xp + xpValue;
                if (NEWXP >= row.next_level_xp) {
                    row.previous_level_xp = row.next_level_xp;
                    row.level += 1;
                    row.next_level_xp = row.next_level_xp * 1.5;
                }
                const currentTIME = new Date()
                if (currentTIME > new Date(row.weekend)) {
                    xpThisWeek = 0 + xpValue;
                } else {
                    xpThisWeek = row.xp_this_week + xpValue;
                }
                let progression = {
                    xp: NEWXP,
                    "previous-level-xp": row.previous_level_xp,
                    "next-level-xp": row.next_level_xp,
                    level: row.level,
                    "rank-name": row.rank_name,
                    "rank-index": row.rank_index,
                    "rank-position": row.rank_position,
                    "rank-round-start": row.rank_round_start,
                    "rank-round-end": row.rank_round_end,
                    "streak-points": row.streak_points,
                    "daily-completed-maps": row.daily_completed_maps,
                    "goal-daily-completed-maps": row.goal_daily_completed_maps,
                    prizes: JSON.parse(row.prizes)
                }
                db.run(`INSERT INTO playerprogression (uid, xp, previous_level_xp, next_level_xp, level, rank_name, rank_index, rank_position, rank_round_start, rank_round_end, streak_points, daily_completed_maps, goal_daily_completed_maps, prizes, xp_this_week, weekstart, weekend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (uid) DO UPDATE SET xp = excluded.xp, previous_level_xp = excluded.previous_level_xp, next_level_xp = excluded.next_level_xp, level = excluded.level, xp_this_week = excluded.xp_this_week, weekstart = excluded.weekstart, weekend = excluded.weekend;`, [
                    uid,
                    progression.xp,
                    progression['previous-level-xp'],
                    progression['next-level-xp'],
                    progression.level,
                    progression["rank-name"],
                    progression["rank-index"],
                    progression["rank-position"],
                    progression["rank-round-start"],
                    progression["rank-round-end"],
                    progression["streak-points"],
                    progression["daily-completed-maps"],
                    progression["goal-daily-completed-maps"],
                    JSON.stringify(progression.prizes),
                    xpThisWeek,
                    getEndOfLastISOWeek(),
                    getStartOfNextISOWeek()
                ], err => {
                    if (err) {
                        console.error("SQLite insert failed:", err);
                        res.status(500).json({ success: false });
                        return;
                    } else {
                        db.all(`SELECT * FROM leaderboard ${query1}`, inputs1,
                            (err, rows) => {
                                if (err) {
                                    console.error(err);
                                    res.status(500).json({ success: false });
                                    return;
                                }
                                const position = rows.findIndex(r => r.player_id === uid) + 1;
                                let data = [
                                    {
                                        "player-id": rows[position - 1].player_id,
                                        "map": rows[position - 1].map,
                                        "track": rows[position - 1].track,
                                        "diameter": rows[position - 1].diameter,
                                        "drl-official": rows[position - 1].drl_official,
                                        "drone-name": rows[position - 1].drone_name,
                                        "drone-guid": rows[position - 1].drone_guid,
                                        "profile-platform-id": rows[position - 1].profile_platform_id,
                                        "username": rows[position - 1].username,
                                        "profile-color": rows[position - 1].profile_color,
                                        "profile-thumb": rows[position - 1].profile_thumb,
                                        "profile-name": rows[position - 1].profile_name,
                                        "profile-platform": rows[position - 1].profile_platform,
                                        "is-custom-map": rows[position - 1].is_custom_map,
                                        "custom-map": rows[position - 1].custom_map,
                                        "mission": rows[position - 1].mission,
                                        "group-id": rows[position - 1].group_id,
                                        "region": rows[position - 1].region,
                                        "replay-url": url + rows[position - 1].replay_url,
                                        "game-type": rows[position - 1].game_type,
                                        "drone-thumb": rows[position - 1].drone_thumb,
                                        "multiplayer": rows[position - 1].multiplayer,
                                        "multiplayer-room-id": rows[position - 1].multiplayer_room_id,
                                        "multiplayer-room-size": rows[position - 1].multiplayer_room_size,
                                        "multiplayer-player-id": rows[position - 1].multiplayer_player_id,
                                        "multiplayer-master-id": rows[position - 1].multiplayer_master_id,
                                        "multiplayer-player-position": rows[position - 1].multiplayer_player_position,
                                        "flag-url": rows[position - 1].flag_url,
                                        "score-type": rows[position - 1].score_type,
                                        "match-id": rows[position - 1].match_id,
                                        "tryouts": rows[position - 1].tryouts,
                                        "battery-resistance": rows[position - 1].battery_resistance,
                                        "controller-type": rows[position - 1].controller_type,
                                        "position": position,
                                        "score": rows[position - 1].score,
                                        "score-check": rows[position - 1].score_check,
                                        "score-double-check": rows[position - 1].score_double_check,
                                        "score-cheat": rows[position - 1].score_cheat,
                                        "score-cheat-ratio": rows[position - 1].score_cheat_ratio,
                                        "score-cheat-samples": rows[position - 1].score_cheat_samples,
                                        "crash-count": rows[position - 1].crash_count,
                                        "top-speed": rows[position - 1].top_speed,
                                        "time-in-first": rows[position - 1].time_in_first,
                                        "lap-times": rows[position - 1].lap_times,
                                        "gate-times": rows[position - 1].gate_times,
                                        "fastest-lap": rows[position - 1].fastest_lap,
                                        "slowest-lap": rows[position - 1].slowest_lap,
                                        "total-distance": rows[position - 1].total_distance,
                                        "percentile": rows[position - 1].percentile,
                                        "order-col": rows[position - 1].order_col,
                                        "high-score": rows[position - 1].high_score,
                                        "race-id": rows[position - 1].race_id,
                                        "limit-col": rows[position - 1].limit_col,
                                        "heat": rows[position - 1].heat,
                                        "custom-physics": rows.custom_physics,
                                        "drl-pilot-mode": rows.drl_pilot_mode,
                                        "drone-rig": rows.drone_rig,
                                        "drone-hash": rows.drone_hash,
                                        "progression": progression,
                                        "high-score": highscore
                                    }
                                ]
                                res.status(200).json({
                                    success: true, data: data
                                });
                            });
                    }
                })
            })
        })
    });
})

app.get('/leaderboards/rivals/', badTokenAuthv2, (req, res) => {
    console.log("req sent to /leaderboards/rivals/ headers are:", req.headers);
    console.log(req.query)
    const uid = req.query['player-id'];
    const diameter = Number(req.query.diameter);
    const drlOfficial = req.query["drl-official"] === "true" ? true : false;
    const IscustomMap = req.query["is-custom-map"] === "true" ? true : false;
    let query;
    let inputs;
    if (req.query['is-custom-map'] == "true") {
        query = `WHERE map = ? AND track = ? AND diameter = ? AND drl_official = ? AND custom_map = ? AND match_id = 'normal' `
        inputs = [req.query.map, req.query.track, diameter, drlOfficial, req.query['custom-map']]
    } else {
        query = `WHERE map = ? AND track = ? AND diameter = ? AND drl_official = ? AND is_custom_map = ? AND match_id = 'normal' `
        inputs = [req.query.map, req.query.track, diameter, drlOfficial, IscustomMap]
    }
    let player_pos = 0
    db.all(`SELECT l.*,
                COALESCE(p.player_id, l.player_id) AS player_id,
                COALESCE(p.profile_name, l.profile_name) AS profile_name,
                COALESCE(p.profile_photo_url, l.profile_thumb) AS profile_thumb,
                COALESCE(p.profile_color, l.profile_color) AS profile_color
                FROM leaderboard l LEFT JOIN profilestatemodel p ON p.player_id = l.player_id ` + query + `ORDER BY score ASC`, inputs, (err, row) => {
        console.log(row)
        if (err || row.length === 0) {
            console.error("Error fetching leaderboard:", err);
            let jsondata = {
                "top": [
                    null
                ],
                "player": 0,
                "rivals": [null],
                "past": null
            }
            res.status(200).json({
                success: true, data: jsondata
            });
        } else {
            let rivals = []
            row[0].position = 1
            for (let i = 0; i < row.length; i++) {
                if (row[i].player_id == uid) {
                    player_pos = i

                    const RIVAL_WINDOW = 3;
                    let start = player_pos - 1;
                    let end = player_pos + RIVAL_WINDOW;

                    if (start < 0) {
                        end += -start;
                        start = 0;
                    }
                    if (end > row.length) {
                        start -= (end - row.length);
                        start = Math.max(0, start);
                    }

                    for (let i = start; i < end; i++) {
                        if (row[i]) {
                            console.log(i)
                            console.log(row[i])
                            rivals.push(mapLeaderboardSqlToJson(row, i));
                        }
                    }
                    break;
                }
            }
            let jsondata = {
                "top": [
                    mapLeaderboardSqlToJson(row, 0)
                ],
                "player": player_pos,
                "rivals": rivals,
                "past": mapLeaderboardSqlToJson(row, player_pos)
            }
            console.log(jsondata)
            res.status(200).json({
                success: true, data: jsondata
            });
        }
    });
});

app.get(`/replay/rivals/`, (req, res) => {
    console.log("req sent to /leaderboards/rivals/ headers are:", req.headers);
    console.log(req.query)
    const uid = req.query['player-id'];
    const diameter = Number(req.query.diameter);
    const drlOfficial = req.query["drl-official"] === "true" ? 1 : 0;
    let query;
    let inputs;
    if (req.query['is-custom-map'] == `true`) {
        query = `WHERE map = ? AND track = ? AND diameter = ? AND drl_official = ? AND custom_map = ? AND match_id = 'normal' `
        inputs = [req.query.map, req.query.track, diameter, drlOfficial, req.query['custom-map']]
    } else {
        query = `WHERE map = ? AND track = ? AND diameter = ? AND drl_official = ? AND custom_map = ? AND match_id = 'normal' `
        inputs = [req.query.map, req.query.track, diameter, drlOfficial, req.query['custom-map'] ? req.query['custom-map'] : false]
    }
    let player_pos = 0
    db.all(`SELECT * FROM leaderboard l LEFT JOIN profilestatemodel p ON p.player_id = l.player_id ` + query + `ORDER BY score ASC`, inputs, (err, row) => {
        console.log(row)
        if (err || row.length === 0) {
            console.error("Error fetching leaderboard:", err);
            let jsondata = {
                "top": [
                    null
                ],
                "player": 0,
                "rivals": [null],
                "past": null
            }
            res.status(200).json({
                success: true, data: jsondata
            });
        } else {
            let rivals = []
            row[0].position = 1
            for (let i = 0; i < row.length; i++) {
                if (row[i].player_id == uid) {
                    player_pos = i

                    const RIVAL_WINDOW = 3;
                    let start = player_pos - 1;
                    let end = player_pos + RIVAL_WINDOW;

                    if (start < 0) {
                        end += -start;
                        start = 0;
                    }
                    if (end > row.length) {
                        start -= (end - row.length);
                        start = Math.max(0, start);
                    }

                    for (let i = start; i < end; i++) {
                        if (row[i]) {
                            console.log(i)
                            console.log(row[i])
                            rivals.push(mapLeaderboardSqlToJson(row, i));
                        }
                    }
                    break;
                }
            }
            let jsondata = {
                "top": [
                    mapLeaderboardSqlToJson(row, 0)
                ],
                "player": player_pos,
                "rivals": rivals,
                "past": mapLeaderboardSqlToJson(row, player_pos)
            }
            console.log(jsondata)
            res.status(200).json({
                success: true, data: jsondata
            });
        }
    });
})

app.get('/leaderboards/', badTokenAuthv2, (req, res) => {
    let limit = 10
    let page = 1
    if (!req.query.limit) {
        limit = 10
    } else {
        limit = req.query.limit
    }
    if (!req.query.page || req.query.page == 0) {
        page = 1
    } else {
        page = req.query.page
    }



    const offset = (page - 1) * limit;
    console.log(req.query)
    const allowed = ["player-id", "map", "track", "diameter", "drl-official", "drone-name", "drone-guid", "profile-platform-id", "username", "profile-color", "profile-thumb", "profile-name", "profile-platform", "is-custom-map", "custom-map", "mission", "group-id", "region", "replay-url", "game-type", "drone-thumb", "multiplayer", "multiplayer-room-id", "multiplayer-room-size", "multiplayer-player-id", "multiplayer-master-id", "multiplayer-player-position", "flag-url", "score-type", "match-id", "tryouts", "battery-resistance", "controller-type", "position", "score", "score-check", "score-double-check", "score-cheat", "score-cheat-ratio", "score-cheat-samples", "crash-count", "top-speed", "time-in-first", "lap-times", "gate-times", "fastest-lap", "slowest-lap", "total-distance", "percentile", "order-col", "high-score", "race-id", "limit-col", "heat", "custom-physics", "drl-pilot-mode", "drone-rig", "drone-hash",]
    const filteredQuery = Object.fromEntries(
        Object.entries(req.query).filter(([key]) => allowed.includes(key))
    );

    const normalizeValue = (value) => {
        if (Array.isArray(value)) {
            return value.map(normalizeValue);
        }

        if (value === "true") return 1;
        if (value === "false") return 0;

        if (typeof value === "string" && value.trim() !== "" && !isNaN(value)) {
            return Number(value);
        }

        return value;
    };

    const normalizedQuery = Object.fromEntries(
        Object.entries(filteredQuery).map(([key, value]) => [
            key.replace(/-/g, "_"),
            normalizeValue(value)
        ])
    );

    if (req.query.match) {
        normalizedQuery.match_id = req.query.match
        normalizedQuery
    }
    console.log(normalizedQuery)
    const keys = Object.keys(normalizedQuery);
    const conditions = keys.map(key => `${key} = ?`);
    const values = Object.values(normalizedQuery);


    db.all(`SELECT l.*,
                COALESCE(p.player_id, l.player_id) AS player_id,
                COALESCE(p.profile_name, l.profile_name) AS profile_name,
                COALESCE(p.profile_photo_url, l.profile_thumb) AS profile_thumb,
                COALESCE(p.profile_color, l.profile_color) AS profile_color
                FROM leaderboard l LEFT JOIN profilestatemodel p ON p.player_id = l.player_id WHERE ${conditions.join(' AND ')} ORDER BY score ASC LIMIT ? OFFSET ?`, [...values, limit, offset], (err, row) => {
        console.log(`SELECT * FROM leaderboard l LEFT JOIN profilestatemodel p ON p.player_id = l.player_id WHERE ${conditions.join(' AND ')} ORDER BY score ASC LIMIT ? OFFSET ?`, ...values, limit, offset)
        if (err || row.length === 0) {
            console.error("Error fetching leaderboard:", err);
            res.status(200).json({
                success: true, data: {
                    "leaderboard": [],
                    "pagging": { "page": page, "limit": limit, "total": 2 }
                }
            });
        } else {
            let jsondata = []
            for (let i = 0; i < row.length; i++) {
                let data = mapLeaderboardSqlToJson(row, i)
                jsondata.push(data)
            }
            res.status(200).json({
                success: true, data: {
                    "leaderboard": jsondata,
                    "pagging": { "page": page, "limit": limit, "total": Math.ceil(row.length / limit) }
                }
            });
        }
    });
});


/*
----------------------------------------------------------------------------------------
██████╗ ██████╗  ██████╗  ██████╗ ██████╗ ███████╗███████╗███████╗██╗ ██████╗ ███╗   ██╗
██╔══██╗██╔══██╗██╔═══██╗██╔════╝ ██╔══██╗██╔════╝██╔════╝██╔════╝██║██╔═══██╗████╗  ██║
██████╔╝██████╔╝██║   ██║██║  ███╗██████╔╝█████╗  ███████╗███████╗██║██║   ██║██╔██╗ ██║
██╔═══╝ ██╔══██╗██║   ██║██║   ██║██╔══██╗██╔══╝  ╚════██║╚════██║██║██║   ██║██║╚██╗██║
██║     ██║  ██║╚██████╔╝╚██████╔╝██║  ██║███████╗███████║███████║██║╚██████╔╝██║ ╚████║
╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝
----------------------------------------------------------------------------------------
*/

app.get('/experience-points/ranking/', badTokenAuthv2, (req, res) => {
    console.log("req sent to /experience-points/ranking/:", req.headers);
    const uid = req.uid;
    db.get(`SELECT league_guid FROM playerprogression WHERE uid = ?`, [uid], (err, row) => {
        if (err || !row) {
            console.error("Error fetching playerprogression:", err);
            res.status(500).json({ success: false });
            return;
        } else {
            if (row.xp_this_week == 0) {
                res.status(200).json({ success: true, data: null });
            } else {
                const leagueGuid = row.league_guid;
                db.all(`SELECT * FROM playerprogression WHERE league_guid = ?`, [leagueGuid], (err, row) => {
                    if (err || !row) {
                        console.error("Error fetching playerprogression:", err);
                        res.status(500).json({ success: false });
                        return;
                    } else {
                        let ranking = []
                        //TODO: Rework this
                        for (let i = 0; i < row.length; i++) {
                            if (row[i].uid == uid) {
                                let data = {
                                    "is-player": true,
                                    "is-top": i < 3 ? true : false,
                                    "is-bottom": i > row.length - 3 && i > 6 ? true : false,
                                    "profile-color": "3FA9F5",
                                    "profile-thumb": "https://avatars.githubusercontent.com/u/131718510?v=4&size=64",
                                    "profile-name": "YOU",
                                    "position": i + 1,
                                    "type": "player",
                                    "xp": row[i].xp_this_week
                                }
                                ranking.push(data)
                            } else {
                                let data = {
                                    "is-player": false,
                                    "is-top": i < 3 ? true : false,
                                    "is-bottom": i > row.length - 3 && i > 6 && leagueGuid !== "LG-1" ? true : false,
                                    "profile-color": "3FA9F5",
                                    "profile-thumb": "https://avatars.githubusercontent.com/u/131718510?v=4&size=64",
                                    "profile-name": "not you",
                                    "position": i + 1,
                                    "type": "player",
                                    "xp": row[i].xp_this_week
                                }
                                ranking.push(data)
                            }
                        }
                        let jsondata = {
                            "league": {
                                "name": "filler",
                                "guid": row.league_guid
                            },
                            "start-at": row.weekstart,
                            "end-at": row.weekend,
                            "ranking": ranking
                        };
                        res.status(200).json({ success: true, data: jsondata });
                    }
                });
            }
        }
    });
})


app.get('/experience-points/progression/', badTokenAuthv2, (req, res) => {
    const payload = {
        "xp": 0,
        "previous-level-xp": 0,
        "next-level-xp": 100,
        "level": 1,
        "rank-name": "Bronze",
        "rank-index": 0,
        "rank-position": 0,
        "rank-round-start": getEndOfLastISOWeek(),
        "rank-round-end": getStartOfNextISOWeek(),
        "streak-points": 0,
        "daily-completed-maps": 0,
        "goal-daily-completed-maps": 0,
        "prizes": []
    };
    const uid = req.uid;
    db.get(`SELECT * FROM playerprogression WHERE uid = ?`, [uid], (err, row) => {
        if (err) {
            console.error("Error fetching playerprogression:", err);
            res.status(500).json({ success: false });
            return;
        } else if (!row) {
            console.log("No player progression found for UID:", uid);
            db.run(`INSERT INTO playerprogression (uid, xp, previous_level_xp, next_level_xp, level, rank_name, rank_index, rank_position, rank_round_start, rank_round_end, streak_points, daily_completed_maps, goal_daily_completed_maps, prizes, league_guid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    uid,
                    payload.xp,
                    payload['previous-level-xp'],
                    payload['next-level-xp'],
                    payload.level,
                    payload["rank-name"],
                    payload["rank-index"],
                    payload["rank-position"],
                    payload["rank-round-start"],
                    payload["rank-round-end"],
                    payload["streak-points"],
                    payload["daily-completed-maps"],
                    payload["goal-daily-completed-maps"],
                    JSON.stringify(payload.prizes),
                    "LG-1"
                ], err => {
                    if (err) {
                        console.error("Error inserting default progression:", err);
                        res.status(500).json({ success: false });
                        return
                    } else {
                        console.log("Inserted default progression for UID:", uid);
                        res.status(200).json({ success: true, data: payload });
                        return
                    }
                })
        } else {
            let jsondata = {
                xp: row.xp,
                "previous-level-xp": row.previous_level_xp,
                "next-level-xp": row.next_level_xp,
                level: row.level,
                "rank-name": row.rank_name,
                "rank-index": row.rank_index,
                "rank-position": row.rank_position,
                "rank-round-start": row.rank_round_start,
                "rank-round-end": row.rank_round_end,
                "streak-points": row.streak_points,
                "daily-completed-maps": row.daily_completed_maps,
                "goal-daily-completed-maps": row.goal_daily_completed_maps,
                prizes: JSON.parse(row.prizes)
            }
            res.status(200).json({ success: true, data: jsondata });
        }
    });
})

/*
-----------------------------------------------------
██╗     ██╗ ██████╗███████╗███╗   ██╗███████╗███████╗
██║     ██║██╔════╝██╔════╝████╗  ██║██╔════╝██╔════╝
██║     ██║██║     █████╗  ██╔██╗ ██║███████╗█████╗
██║     ██║██║     ██╔══╝  ██║╚██╗██║╚════██║██╔══╝
███████╗██║╚██████╗███████╗██║ ╚████║███████║███████╗
╚══════╝╚═╝ ╚═════╝╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝
-----------------------------------------------------
*/

app.get(`/player/license/`, (req, res) => {
    console.log("NEW LICENSE REQUEST:", req.headers);
    const base64Data = Buffer.from(JSON.stringify({ exists: true })).toString('base64');
    res.status(200).json({ success: true, data: base64Data });
});

/*
------------------------------------------------------
██████╗  █████╗ ███╗   ██╗██████╗  ██████╗ ███╗   ███╗
██╔══██╗██╔══██╗████╗  ██║██╔══██╗██╔═══██╗████╗ ████║
██████╔╝███████║██╔██╗ ██║██║  ██║██║   ██║██╔████╔██║
██╔══██╗██╔══██║██║╚██╗██║██║  ██║██║   ██║██║╚██╔╝██║
██║  ██║██║  ██║██║ ╚████║██████╔╝╚██████╔╝██║ ╚═╝ ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝
------------------------------------------------------
*/

app.post('/drones/', express.urlencoded({ extended: true }), badTokenAuthv2, (req, res) => {
    console.log("req sent to /drones/ headers are: ", req.headers);
    console.log(req.body);
    const uid = req.uid;
    db.run(`INSERT INTO drone (
                    guid,
                    player_id,
                    profile_platform_id,
                    profile_platform,
                    profile_color,
                    profile_thumb,
                    profile_name,
                    score,
                    rating,
                    rating_count,
                    thumb_url,
                    name,
                    is_public,
                    is_official,
                    is_custom_physics,
                    flight_time,
                    flight_total,
                    size,
                    thrust,
                    speed,
                    weight,
                    rpm,
                    frame_id,
                    motor_id,
                    prop_id,
                    battery_id,
                    rig_data,
                    profile_data,
                    physics_data
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                ON CONFLICT (guid) DO UPDATE SET
                    player_id           = excluded.player_id,
                    profile_platform_id = excluded.profile_platform_id,
                    profile_platform    = excluded.profile_platform,
                    profile_color       = excluded.profile_color,
                    profile_thumb       = excluded.profile_thumb,
                    profile_name        = excluded.profile_name,
                    score               = excluded.score,
                    rating              = excluded.rating,
                    rating_count        = excluded.rating_count,
                    thumb_url           = excluded.thumb_url,
                    name                = excluded.name,
                    is_public            = excluded.is_public,
                    is_official          = excluded.is_official,
                    is_custom_physics    = excluded.is_custom_physics,
                    flight_time          = excluded.flight_time,
                    flight_total         = excluded.flight_total,
                    size                 = excluded.size,
                    thrust               = excluded.thrust,
                    speed                = excluded.speed,
                    weight               = excluded.weight,
                    rpm                  = excluded.rpm,
                    frame_id             = excluded.frame_id,
                    motor_id             = excluded.motor_id,
                    prop_id              = excluded.prop_id,
                    battery_id           = excluded.battery_id,
                    rig_data             = excluded.rig_data,
                    profile_data         = excluded.profile_data,
                    physics_data         = excluded.physics_data;`,
        [
            req.body.guid,
            uid,
            req.body['profile-platform-id'],
            req.body['profile-platform'],
            req.body['profile-color'],
            req.body['profile-thumb'],
            req.body['profile-name'],
            req.body.score,
            req.body.rating,
            req.body['rating-count'],
            req.body['thumb-url'],
            req.body.name,
            req.body['is-public'],
            req.body['is-official'],
            req.body['is-custom-physics'],
            req.body['flight-time'],
            req.body['flight-total'],
            req.body.size,
            req.body.thrust,
            req.body.speed,
            req.body.weight,
            req.body.rpm,
            req.body['frame-id'],
            req.body['motor-id'],
            req.body['prop-id'],
            req.body['battery-id'],
            JSON.stringify(req.body['rig-data']),
            JSON.stringify(req.body['profile-data']),
            JSON.stringify(req.body['physics-data'])
        ], err => {
            if (err) {
                console.error("Error inserting/updating drone:", err);
                res.status(500).json({ success: false });
                return;
            } else {
                res.status(200).json({ success: true, data: req.body })
            }
        })
});

app.get('/drones/:guid/remove/', badTokenAuthv2, (req, res) => {
    const uid = req.uid;
    db.run(`DELETE FROM drone WHERE guid = ? AND player_id = ?`, [req.params.guid, uid], function (err) {
        if (err) {
            console.error("Error deleting drone:", err);
            res.status(500).json({ success: true });
            return
        }
        res.status(200).json({ success: true });
    });
});

app.get('/drones/', (req, res) => {
    console.log('/drones/')
    console.log(req.query)
    let data = []
    let sql = "SELECT * FROM drone d LEFT JOIN profilestatemodel p ON p.player_id = d.player_id";
    let params = [];
    if (req.query['player-id'] != null) {
        if (req.query['player-id']) {
            sql += " WHERE d.player_id = ?"
            params.push(req.query['player-id']);
        }
    } else {
        if (req.query["is-public"] != null) {
            const isPublic = req.query["is-public"] === "true" ? "true" : "false";
            sql += " WHERE is_public = ?";
            params.push(isPublic);
        } else {
            const pub = true
        }
    }
    console.log("DRONES")
    console.log(sql, params)
    db.all(sql, params, (err, row) => {
        if (err || row.length === 0) {
            console.error("Error fetching drones:", err);
        } else {
            for (let i = 0; i < row.length; i++) {
                let dat = {
                    "guid": row[i].guid,
                    "player-id": row[i].player_id,
                    "profile-platform-id": row[i].profile_platform_id,
                    "profile-platform": row[i].profile_platform,
                    "profile-color": row[i].profile_color,
                    "profile-thumb": row[i].profile_photo_url,
                    "profile-name": row[i].profile_name,
                    "score": row[i].score,
                    "rating": row[i].rating,
                    "rating-count": row[i].rating_count,
                    "thumb-url": url + row[i].thumb_url,
                    "name": row[i].name,
                    "is-public": row[i].is_public,
                    "is-official": row[i].is_official,
                    "is-custom-physics": row[i].is_custom_physics,
                    "flight-time": row[i].flight_time,
                    "flight-total": row[i].flight_total,
                    "size": row[i].size,
                    "thrust": row[i].thrust,
                    "speed": row[i].speed,
                    "weight": row[i].weight,
                    "rpm": row[i].rpm,
                    "frame-id": row[i].frame_id,
                    "motor-id": row[i].motor_id,
                    "prop-id": row[i].prop_id,
                    "battery-id": row[i].battery_id,
                    "rig-data": JSON.parse(row[i].rig_data),
                    "profile-data": JSON.parse(row[i].profile_data),
                    "physics-data": JSON.parse(row[i].physics_data),
                }
                data.push(dat);
                console.log(dat)
            }
        }
        res.status(200).json({
            success: true,
            "data": {
                "data": data,
                pagging: { page: req.query.page, limit: req.query.limit, total: row.length }
            }
        });
    });
});

app.get('/time/', (req, res) => {
    res.status(200).json({ success: true, data: getTimeBase64() });
})


app.get(`/store/`, (req, res) => {
    res.status(200).json({ success: true, data: null, pagging: { "page-total": 0, "page": 0 } });
})

//TODO: Fix crash dummy data
//filler data
app.get('/crash-settings', (req, res) => {
    res.status(200).json({ success: true, data: null });
});


app.get('/circuits/', (req, res) => {
    const payload = [];
    const base64Data = Buffer.from(JSON.stringify(payload)).toString('base64');
    res.status(200).json({ success: true, data: payload });
})

function getTimeBase64() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const timeStr = `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}-00`;

    const payload = { time: timeStr };
    const base64Data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    return base64Data;
}

function getStartOfNextISOWeek() {
    const today = new Date();

    const todayISODay = today.getDay() === 0 ? 7 : today.getDay();

    const daysUntilNextMonday = 8 - todayISODay;

    today.setDate(today.getDate() + daysUntilNextMonday);
    today.setHours(23, 59, 59, 999);


    return today.toISOString().split('T')[0];
}


function getEndOfLastISOWeek() {
    const today = new Date();

    const daysSinceLastSunday = today.getDay() === 0 ? 7 : today.getDay();

    const lastSunday = new Date(today.setDate(today.getDate() - daysSinceLastSunday));

    lastSunday.setHours(23, 59, 59, 999);

    const isoString = lastSunday.toISOString();

    return isoString;
}

function decryptDRL(token, keyString, ivString) {
    const key = Buffer.from(keyString, 'utf8');
    const iv = Buffer.from(ivString, 'utf8');
    const encrypted = Buffer.from(token, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    if (decrypted[0] === 0xEF && decrypted[1] === 0xBB && decrypted[2] === 0xBF) {
        decrypted = decrypted.slice(3);
    }

    const decryptedText = decrypted.toString('utf8');
    return JSON.parse(decryptedText);
}


app.use(session({
    secret: process.env.SESSION_SECRET || 'secretKey',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));


app.use(express.urlencoded({ extended: true }))

app.use(csrf({
    whitelist: ['/adminlogin']
}));

const protect = (req, res, next) => {
    if (req.session && req.session.adminId) {
        next();
    } else {
        res.redirect('/adminlogin');
    }
};

app.use('/admin', protect);

app.use('/admin', express.static('admin'));

app.use('/adminlogin', express.static('adminlogin'));

app.post(`/adminlogin`, express.urlencoded({ extended: true }), (req, res) => {
    const { username, password } = req.body
    db.get('SELECT * FROM adminusers WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).send("Database error");
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.adminId = user.id;
                return res.redirect(`/admin/dashboard`)
            }
        }
        res.status(401).send("<h1>Invalid username or password</h1>");
    });
})


app.post(`/admin/changepassword`, express.urlencoded({ extended: true }), (req, res) => {
    const { username, new_username, password, new_password } = req.body
    db.get('SELECT * FROM adminusers WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).send("Database error");
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const userId = user.id
                if (new_username != "" && new_password != "") {
                    db.run('UPDATE adminusers SET username = ?, password = ? WHERE id = ?', [new_username, await bcrypt.hash(new_password, 10), userId], function (err) {
                        if (err) {
                            console.error("Error updating admin user:", err);
                            return res.status(500).send("Database error");
                        }
                        req.session.destroy(err => {
                            if (err) {
                                console.error("Error destroying session:", err);
                                return res.status(500).send("Error updating credentials, please try again");
                            }
                            return res.redirect('/adminlogin');
                        });
                    })
                } else if (new_username != "" && new_password == "") {
                    db.run('UPDATE adminusers SET username = ? WHERE id = ?', [new_username, userId], function (err) {
                        if (err) {
                            console.error("Error updating admin user:", err);
                            return res.status(500).send("Database error");
                        }
                        req.session.destroy(err => {
                            if (err) {
                                console.error("Error destroying session:", err);
                                return res.status(500).send("Error updating credentials, please try again");
                            }
                            return res.redirect('/adminlogin');
                        });
                    })
                } else if (new_username == "" && new_password != "") {
                    db.run('UPDATE adminusers SET password = ? WHERE id = ?', [await bcrypt.hash(new_password, 10), userId], function (err) {
                        if (err) {
                            console.error("Error updating admin user:", err);
                            return res.status(500).send("Database error");
                        }
                        req.session.destroy(err => {
                            if (err) {
                                console.error("Error destroying session:", err);
                                return res.status(500).send("Error updating credentials, please try again");
                            }
                            return res.redirect('/adminlogin');
                        });
                    })
                }
            } else {
                res.status(401).send("<h1>Invalid username or password</h1>");
            }
        } else {
            res.status(401).send("<h1>Invalid username or password</h1>");
        }
    });
})

app.post(`/admin/reboot`, express.urlencoded({ extended: true }), (req, res) => {
    pm2.connect((err) => {
        if (err) {
            res.status(500).json({ success: false, message: "Error connecting to pm2" });
            return;
        }

        pm2.reload('all', (err, proc) => {
            if (err) {
                pm2.disconnect();
                res.status(500).json({ success: false, message: "Error restarting process" });
            } else {
                res.status(200).json({ success: true, message: "Process restarted successfully" });
            }

            setTimeout(() => {
                pm2.disconnect();
            }, 1000);
        });
    });
})


app.post(`/admin/add-map-pool/`, express.json(), (req, res) => {
    db.run("INSERT INTO map_pools (pool_name) VALUES (?)", [req.body.pool_name], function (err) {
        if (err) {
            res.status(500).json({ success: false, message: "Database error" });
            return;
        } else {
            res.status(200).json({ success: true, message: "Map pool added successfully", poolId: this.lastID });
        }
    })
})

app.post(`/admin/add-map-to-map-pool/`, express.json(), (req, res) => {
    const { map_guid, pool_name, map, track } = req.body
    db.get("SELECT id FROM map_pools WHERE pool_name = ?", [pool_name], (err, row) => {
        if (err || !row) {
            res.status(404).json({ success: false, message: "Map pool not found" });
            return;
        } else {
            const id = row.id
            if (track != "null") {
                console.log(track)
                db.run(`INSERT INTO poolmaps (pool_id, map, track, is_custom_map) VALUES (?, ?, ?, ?)`, [id, map, track, false], (err) => {
                    if (err) {
                        res.status(500).json({ success: false, message: "Database error on hard coded maps: " + err });
                        return;
                    }
                    res.status(200).json({ success: true, message: "Hard coded map added to pool successfully" });
                });
            } else {
                db.get(`SELECT map_title FROM communitytracks WHERE guid = ?`, [map_guid], (err, row) => {
                    if (err || !row) {
                        res.status(500).json({ success: false, message: "Database error on finding map" })
                        return
                    } else {
                        db.run(`INSERT INTO poolmaps (pool_id, map, is_custom_map, custom_map, custom_map_title) VALUES (?, ?, ?, ?, ?)`, [id, map, true, map_guid, row.map_title], (err) => {
                            if (err) {
                                res.status(500).json({ success: false, message: "Database error on inserting custom map" });
                                return;
                            }
                            res.status(200).json({ success: true, message: "Map added to pool successfully" });
                        });
                    }
                })
            }
        }
    })
})

app.get(`/admin/map-pool/`, express.json(), (req, res) => {
    db.all("SELECT map_pools.pool_name, COUNT(poolmaps.id) AS map_count FROM map_pools LEFT JOIN poolmaps ON map_pools.id = poolmaps.pool_id GROUP BY map_pools.id", [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, message: "Database error" });
            return;
        } else {
            res.status(200).json({ success: true, data: rows });
        }
    })
})


app.post(`/admin/pull-updates/`, express.urlencoded({ extended: true }), (req, res) => {
    exec('git pull', (error, stdout, stderr) => {
        if (error) {
            res.status(500).json({ success: false, message: `Error: ${error.message}` });
            return;
        }
        if (stderr) {
            res.status(500).json({ success: false, message: `Stderr: ${stderr}` })
        }
        res.status(200).json({ success: true, message: `Stdout: ${stdout}` });
    });
})

app.get(`/admin/maps-count`, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM communitytracks`, (err, result) => {
        if (err) {
            res.status(500).json({ success: false, message: "Database error" });
            return;
        }
        res.status(200).json({ success: true, count: result.total });
    });
});

app.get(`/admin/users-count`, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM user`, (err, result) => {
        if (err) {
            res.status(500).json({ success: false, message: "Database error" });
            return;
        }
        res.status(200).json({ success: true, count: result.total });
    });
});

app.get(`/admin/tournaments-count`, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM tournaments`, (err, result) => {
        if (err) {
            res.status(500).json({ success: false, message: "Database error" });
            return;
        }
        res.status(200).json({ success: true, count: result.total });
    });
});



app.get('/admin/maps/', (req, res) => {
    const limit = parseInt(req.query.limit) || 6;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    let sqlSort = "";
    let filters = []
    let filtersP = []
    filters.push(" AND is_race_allowed = 1");
    if (req.query['map-difficulty']) {
        filters.push(`AND map_difficulty = ?`);
        filtersP.push(parseInt(req.query['map-difficulty']));
    }
    if (req.query['map-id']) {
        filters.push("AND map_id = ?");
        filtersP.push(req.query['map-id']);
    }
    if (req.query.q) {
        if (req.query.q.startsWith("@")) {
            filters.push("AND profile_name = ?");
            filtersP.push(req.query.q.toLowerCase().substring(1));
        } else {
            filters.push("AND map_title LIKE ?");
            filtersP.push(`%${req.query.q}%`);
        }
    }
    if (req.query.guid) {
        filters.push("AND guid = ?");
        filtersP.push(req.query.guid);
    }
    if (req.query.sort && req.query.order) {
        const normalizedSort = req.query.sort.replace(/-/g, '_');
        const allowedSortFields = ['score', 'rating_count', 'created_at', 'updated_at'];
        const sortField = allowedSortFields.includes(normalizedSort) ? normalizedSort : 'score';

        const sortOrder = req.query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        sqlSort = `ORDER BY ${sortField} ${sortOrder}`;
        filters.push(sqlSort)
    }
    db.get(
        `SELECT COUNT(*) as total FROM communitytracks WHERE is_public = 1`,
        [],
        (err, countResult) => {
            if (err) {
                console.error("Error counting tracks:", err);
                return res.status(500).json({ success: false });
            }
            const totalCount = countResult.total;
            const totalPages = Math.ceil(totalCount / limit);
            db.all(
                `SELECT *
                FROM communitytracks
                WHERE is_public = 1
                ${filters.join(' ')} LIMIT ? OFFSET ? `,
                [...filtersP, limit, offset],
                (err, rows) => {
                    if (err) {
                        console.error("Error fetching community tracks:", err);
                        return res.status(500).json({ success: false });
                    }
                    const payload = rows.map(row => mapCTracksqlToJson(row));
                    res.status(200).json({ success: true, data: { data: payload, pagging: { page: page, "page-total": totalPages } } });
                    console.log("Returned", payload.length, "tracks for page", page, "of", totalPages);
                }
            );
        }
    );
});

app.get(`/admin/leaderboard-entries-count`, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM leaderboard`, (err, result) => {
        if (err) {
            res.status(500).json({ success: false, message: "Database error" });
            return;
        }
        res.status(200).json({ success: true, count: result.total });
    });
});

app.put(`/admin/tournaments/update/:guid`, express.json(), (req, res) => {
    console.log(`/admin/tournaments/update/${req.params.guid}`)
    console.log(req.body)
    db.run(`UPDATE tournaments SET
        automated_tournament = ?,
        recurr_every_days = ?,
        map_pool = ?,
        map = ?,
        track = ?,
        is_custom_map = ?,
        custom_map = ?,
        custom_map_title = ?,
        id = ?,
        title = ?,
        description = ?,
        call_to_action = ?,
        prize_description = ?,
        prize_url = ?,
        image_url = ?,
        video_url = ?,
        streaming_url = ?,
        terms_and_conditions_url = ?,
        region = ?,
        max_players = ?,
        register_start = ?,
        register_end = ?,
        status = ?,
        type = ?,
        progression = ?,
        allow_new_registration = ?,
        lan_support = ?,
        server_ip = ?,
        disable_public_spectators = ?,
        private = ?,
        penalty = ?,
        drl_pilot_mode = ?,
        drone_guid = ?,
        default_drone_class = ?,
        countdown = ?,
        minimum_skill = ?,
        age_check = ?,
        age_check_number = ?
        WHERE guid = ?;`, [
        req.body.automated,
        req.body.recurr_every_days,
        req.body.map_pool,
        req.body.map,
        req.body.track,
        req.body.is_custom_map,
        req.body.custom_map_guid,
        req.body.custom_map_title,
        req.body.id,
        req.body.title,
        req.body.description,
        req.body.call_to_action,
        req.body.prize_description,
        req.body.prize_url,
        req.body.image_url,
        req.body.video_url,
        req.body.streaming_url,
        req.body.terms_and_conditions_url,
        req.body.region,
        req.body.max_players,
        new Date(req.body.register_start).toISOString(),
        new Date(req.body.register_end).toISOString(),
        req.body.status,
        req.body.type,
        req.body.progression,
        req.body.allow_new_registration,
        req.body.lan_support,
        req.body.server_ip,
        req.body.disable_public_spectators,
        req.body.private,
        req.body.penalty,
        req.body.drl_pilot_mode,
        req.body.drone_guid,
        req.body.drone_class,
        req.body.countdown,
        req.body.minimum_skill,
        req.body.age_check,
        req.body.age_check_number,
        req.params.guid], (err) => {
            if (err) {
                console.error("Error updating tournament:", err);
                return res.status(500).json({ success: false });
            }
            LoadTournaments()
            res.status(200).json({ success: true });
        })
})

app.post(`/admin/createapiKey/`, express.json(), (req, res) => {
    const { name, uid } = req.body
    const token = crypto.randomBytes(32).toString('hex');
    const expires = 0;
    db.run(`INSERT INTO user (uid, token, expires, name) VALUES (?, ?, ?, ?)`, [uid, token, expires, name], (err) => {
        if (err) {
            console.error("/admin/createapiKey/ ERROR: " + err)
            return res.status(500).json({ success: false, message: err })
        }
        res.status(200).json({ success: true, message: token })
    })
})

app.get(`/admin/apikey/`, express.json(), (req, res) => {
    db.all(`SELECT * FROM user WHERE name IS NOT NULL`, [], (err, rows) => {
        if (err) {
            console.error("/admin/apikeys/ ERROR: " + err)
            return res.status(500).json({ success: false, message: err })
        } else if (rows.length === 0) {
            res.status(200).json({ success: true, body: [] })
        } else {
            res.status(200).json({ success: true, body: rows })
        }
    })
})

app.post(`/admin/removeapikey/`, express.json(), (req, res) => {
    const { uid } = req.body
    db.all(`DELETE FROM user WHERE uid = ?`, [uid], (err) => {
        if (err) {
            console.error("/admin/removeapikey/ ERROR: " + err)
            return res.status(500).json({ success: false, message: err })
        }
        res.status(200).json({ success: true })
    })
})

app.post(`/admin/PromoteToDev/`, express.json(), (req, res) => {
    const { ToSet, uid } = req.body
    console.log([ToSet, uid])
    db.run(`UPDATE profilestatemodel SET profile_developer = ? WHERE player_id = ?`, [ToSet, uid], (err) => {
        if (err) {
            console.error("/admin/PromoteToDev/ ERROR: " + err)
            return res.status(500).json({ success: false, message: err })
        }
        res.status(200).json({ success: true })
    })
})


app.get('/admin/players', (req, res) => {

    let jsondata = [];
    db.all(`SELECT * FROM profilestatemodel WHERE profile_name LIKE ?`, [`%${req.query.q}%`], async (err, row) => {
        if (err || row.length === 0) {
            console.error("Error fetching JSON:", err);
            res.status(500).json({ success: false });
            return;
        }
        for (let i = 0; i < row.length; i++) {
            jsondata.push(MapPlayerStateTOJson(row[i]))
        }

        res.status(200).json({ success: true, data: jsondata });
    })
})

app.post(`/admin/tournaments/create/`, express.json(), (req, res) => {
    console.log("Received POST request to create tournament");
    guid = crypto.randomUUID()
    db.run(`INSERT INTO tournaments (
        guid,
        automated_tournament,
        recurr_every_days,
        map_pool,
        map,
        track,
        is_custom_map,
        custom_map,
        custom_map_title,
        id,
        title,
        description,
        call_to_action,
        prize_description,
        prize_url,
        image_url,
        video_url,
        streaming_url,
        terms_and_conditions_url,
        region,
        max_players,
        register_start,
        register_end,
        status,
        type,
        progression,
        allow_new_registration,
        lan_support,
        server_ip,
        disable_public_spectators,
        private,
        penalty,
        drl_pilot_mode,
        drone_guid,
        default_drone_class,
        countdown,
        minimum_skill,
        age_check,
        age_check_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        guid,
        req.body.automated,
        req.body.recurr_every_days,
        req.body.map_pool,
        req.body.map,
        req.body.track,
        req.body.is_custom_map,
        req.body.custom_map_guid,
        req.body.custom_map_title,
        req.body.id,
        req.body.title,
        req.body.description,
        req.body.call_to_action,
        req.body.prize_description,
        req.body.prize_url,
        req.body.image_url,
        req.body.video_url,
        req.body.streaming_url,
        req.body.terms_and_conditions_url,
        req.body.region,
        req.body.max_players,
        new Date(req.body.register_start).toISOString(),
        new Date(req.body.register_end).toISOString(),
        req.body.status,
        req.body.type,
        req.body.progression,
        req.body.allow_new_registration,
        req.body.lan_support,
        req.body.server_ip,
        req.body.disable_public_spectators,
        req.body.private,
        req.body.penalty,
        req.body.drl_pilot_mode,
        req.body.drone_guid,
        req.body.drone_class,
        req.body.countdown,
        req.body.minimum_skill,
        req.body.age_check,
        req.body.age_check_number
    ], (err) => {
        if (err) {
            console.error("Error creating tournament:", err);
            return res.status(500).json({ success: false });
        }
        LoadTournaments()
        res.status(200).json({ success: true });
    });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.send("Error logging out");
        res.redirect('/adminlogin');
    });
});

app.get('/', (req, res) => {
    res.status(200).json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on [${url}](${url})`);
});
