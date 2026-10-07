# Three things the data says about LILA BLACK

All numbers come from the 5 days of data in the repo (Feb 10–14), after removing duplicate rows. Unless I say otherwise, they're based on **human player journeys only** (781 of them). You can reproduce each one in the tool; I've noted the view to use.

---

## 1. Players aren't fighting each other. They're fighting bots, and losing early.

**What caught my eye**

I turned on the "Kill (PvP)" marker expecting red crosses everywhere. Across all three maps there were three, in five days. Everything else was orange: fights with bots.

**The numbers**

- 3 player-vs-player kills, against 2,376 kills on bots.
- 779 of 796 matches have exactly one human in them. The rest of the lobby is bots, or simply wasn't recorded.
- 90% of human deaths are to bots (400 of 442). Only 3 are to other humans; the rest are the storm.
- More than half of all human runs (51%) end with a bot killing the player. It happens fast: half of those deaths come before 4:18, and almost a third (32%) in the first 3 minutes.
- On Lockdown it's even quicker: the median bot death is at 3:38, compared with 4:30 on Ambrose Valley.

*In the tool:* pick any map, keep only the Kill (PvP) and Death (bot) markers, then sort matches by "Most players".

**What I'd do about it**

First, check whether one human per match is real or just how this export was captured. If it's real, the game is a PvE extraction game at the moment, whatever the maps were designed for.

- **Metrics this moves:** PvP encounter rate per match, time to first contact, early-death rate (dead in the first 3 minutes), extraction rate.
- **Actions:**
  - Look at the bot placement around the early-death clusters (Deaths heatmap on Ambrose Valley; they're bunched around the middle of the map).
  - Thin out or slow down the bots players run into straight after spawning.
  - If PvP is meant to be the core, check matchmaking fill. Then add reasons for players to converge, like shared extraction points or one high-value loot spot.

**Why a level designer should care**

Every corridor, piece of cover and sightline is currently being tested against bots, not people. If the maps were balanced around player fights, that balance hasn't been proven by these 5 days of data. Right now the real design lever is where the bots stand.

---

## 2. The storm is three times deadlier on Lockdown and Grand Rift, and it kills the greedy players.

**What caught my eye**

Lockdown has less than a third of Ambrose Valley's matches, yet the storm-deaths counter showed the same number: 17.

**The numbers**

| Map | Human runs | Storm deaths | Storm death rate |
|---|---|---|---|
| Ambrose Valley | 554 | 17 | 3.1% |
| Grand Rift | 57 | 5 | 8.8% |
| Lockdown | 170 | 17 | 10.0% |

- Every storm death in the data happens late. The earliest is at 10:55 and the median is 12:19; all of them are in the last third of their match.
- These aren't unlucky new players. The people the storm caught had picked up more loot (17.6 items on average) than players killed by bots (9.3), and had been alive for about 12.5 minutes. Players who got out typically left at around 8 minutes.
- On Lockdown the storm deaths are spread across the whole map, not in one corner. It's not one bad spot; people are simply too far from a way out when time runs out.

*In the tool:* Lockdown → Storm deaths heatmap + the storm death marker. The ticks on the timeline all sit at the right-hand end.

**What I'd do about it**

The sample is small (39 storm deaths in total), so treat this as a strong hint rather than proof.

- **Metrics this moves:** storm death rate per map, extraction rate, loot lost on death, match length.
- **Actions:**
  - Check how far Lockdown's and Grand Rift's extraction points are from the main loot areas.
  - Make the extraction points easier to see.
  - Add a clear "last call" warning around the 10-minute mark.
  - Possibly add an extraction point on the side of the map where players end up.

**Why a level designer should care**

A storm death feels unfair to players: they lose a full bag of loot after a good run. It's also mostly a layout problem (distance from loot to exit), which makes it something level design can fix directly.

---

## 3. A handful of buildings get all the attention, and big parts of each map are dead space.

**What caught my eye**

With the Loot heatmap on Ambrose Valley, a few buildings glow red and most of the map stays dark. The Traffic heatmap shows people do walk through those dark areas; they just don't stop.

**The numbers** (map split into a 32×32 grid, roughly 28×28 world units per cell on Ambrose Valley)

- On Ambrose Valley, **half of all 8,888 loot pickups happen in 4.5% of the area players walk through**.
- 42% of the walkable area has **zero** loot pickups.
- The single busiest spot, a compound in the south-west, accounts for 537 pickups: 6% of all loot on the map, in one cell.
- Deaths follow the same pattern: half of all deaths happen in 5.4% of the area, and 71% of the map never sees a single death.
- It's the same on the other maps: half of all loot comes from 5.7% of Lockdown and 6.1% of Grand Rift.

*In the tool:* Ambrose Valley → Loot heatmap (paths off), then switch to Traffic and compare.

**What I'd do about it**

- **Metrics this moves:** the share of the map that sees any loot, how evenly traffic is spread, time to first loot, how many points of interest a player visits per run.
- **Actions:**
  - Move or add mid-tier loot in the cold areas, especially along the map edges.
  - Make the hottest compound less dominant, or give it a matching risk such as tougher bots.
  - Re-check after a week using the same heatmaps.

**Why a level designer should care**

Areas nobody stops in are art and design time that players never see. And when everyone runs to the same few buildings, every match plays out the same way, which also makes bot fights predictable (see insight 1). Spreading value across the map is the cheapest way to make runs feel different.
