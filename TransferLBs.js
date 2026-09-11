const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('main.db');


db.serialize(() => {


    db.run("PRAGMA foreign_keys = OFF;")

    db.get(`
    SELECT COUNT(*) AS duplicates_to_delete
    FROM leaderboard
    WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM leaderboard
        GROUP BY player_id, map, track, diameter,
        drl_official, custom_map, match_id, heat
    )
`, (err, row) => {
        if (err) throw err;
        console.log(`Duplicates to delete: ${row.duplicates_to_delete}`);
    });

    db.run("ALTER TABLE leaderboard RENAME TO old_leaderboardOne;")

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


    db.run(`INSERT INTO leaderboard (
    player_id, profile_name, profile_color, map, track, is_custom_map, custom_map, mission, 
    group_id, game_type, diameter, drone_name, drone_thumb, multiplayer, multiplayer_room_id, 
    multiplayer_room_size, multiplayer_player_id, multiplayer_master_id, multiplayer_player_position, 
    flag_url, score_type, match_id, tryouts, battery_resistance, controller_type, score, 
    score_check, score_double_check, score_cheat, score_cheat_ratio, score_cheat_samples, 
    crash_count, top_speed, time_in_first, lap_times, gate_times, fastest_lap, slowest_lap, 
    total_distance, order_col, high_score, race_id, limit_col, heat, custom_physics, 
    drl_official, drl_pilot_mode, drone_guid, drone_rig, drone_hash, updated_at
)
SELECT
    player_id, profile_name, profile_color, map, track, is_custom_map, custom_map, mission, 
    group_id, game_type, diameter, drone_name, drone_thumb, multiplayer, multiplayer_room_id, 
    multiplayer_room_size, multiplayer_player_id, multiplayer_master_id, multiplayer_player_position, 
    flag_url, score_type, match_id, tryouts, battery_resistance, controller_type, score, 
    score_check, score_double_check, score_cheat, score_cheat_ratio, score_cheat_samples, 
    crash_count, top_speed, time_in_first, lap_times, gate_times, fastest_lap, slowest_lap, 
    total_distance, order_col, high_score, race_id, limit_col, heat, custom_physics, 
    drl_official, drl_pilot_mode, drone_guid, drone_rig, drone_hash, updated_at 
FROM old_leaderboardOne`, (err) => {
        if (err) {
            console.error("INSERT FAILED:", err);
            return;
        }

        console.log("INSERT succeeded");

        db.run(`DROP TABLE old_leaderboardOne`, (err) => {
            if (err) console.error("DROP FAILED:", err);
        });
    })

    //db.run(`DROP TABLE old_leaderboardOne;`)

    db.run(`PRAGMA foreign_keys = ON;`)
})