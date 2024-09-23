# NE 511 NH/VT/ME Data to Discord

This Google Apps Script fetches incident and lane closure data from the New England 511 (NH/VT/ME) API and posts relevant information to a designated Discord webhook. This script filters and processes XML data feeds, then structures and formats the data as rich embedded messages for Discord.

## Features

- Fetches real-time incident and lane closure data from NE 511 (NH/VT/ME).
- Filters incidents and lane closures based on predefined patterns.
- Posts relevant alerts to a Discord webhook with rich embed formatting.
- Ensures duplicate or unwanted alerts are not posted.

## Installation

1. **Create a new Google Apps Script project**:
   - Go to https://script.google.com.
   - Click on the `New Project` button.
   - Name your project.

2. **Copy the code into the script file**:
   - Replace `Code.gs` content with the provided script.

3. **Set up the properties for script storage**:
   - Go to `File` > `Project Properties`.
   - Click on the `Script Properties` tab.
   - Add properties for `NE_511_NH_incidentData_lastRunTime` and `NE_511_NH_laneClosureData_lastRunTime`.

4. **Schedule the script**:
   - Click on the clock icon to open the Triggers page (or go to `Edit` > `Current project's triggers`).
   - Add a trigger to run `process_NE511_NH_XmlFeed_to_Discord` periodically.

## Filtering Details

### Part 1: Included messages that pass the following:

```javascript
postPatternNH = /\b(closed|closure|blocked|blocking|flooded|tree in|water over|shut\s+down|all\s+lanes|both\s+lanes|across\s+the\s+(road|street))\b/i
```
This pattern matches any description that contains one of the following keywords or phrases, indicating a significant traffic-related event:
   - closed: The word "closed or closure" anywhere in the description.
   - blocked: The word "blocked or blocking" anywhere in the description.
   - flooded: The word "flooded" anywhere in the description.
   - tree in or water over: The words "tree in" or "water over" anywhere in the description.
   - shut down: The phrase "shut down" anywhere in the description.
   - all lanes: The phrase "all lanes" or "both lanes" anywhere in the description.
   - across the road: The phrase "across the road" or "across the street" anywhere in the description.

### Part 2: For messages that pass part 1, test them for specific lane-related closures or blockages and filter them out:
```javascript
exclusionPatternNH = /(?:\b(Lane\s+(1|2|3|4|one|two|three|four))|((Right|Left|Center|shoulder|median|Right\s+Turn|Left\s+Turn)\s+lane(s)?|(shoulder|median))\s+(is\s+|are\s+)?(currently\s+)?(closed|blocked)|Closed\s+temporarily|\b(one|1)\s+(northbound|southbound|eastbound|westbound)\s+lane\s+(is\s+|are\s+)?(currently\s+)?(closed|blocked))\b/i;
```
This pattern excludes any description that contains specific lane-related closures or blockages to avoid over-reporting minor lane closures. The following criteria are used for exclusion:

   - Lane specific closures:
     - Descriptions that mention specific lanes such as Lane 1 or One, Lane 2 or Two, etc.
   - Directional or positional lane closures for:
     - Right lane, Left lane, Center lane, shoulder, median, Right Turn lane, Left Turn lane.
     - Variations such as ORT (Open Road Tolling), EZ PASS, EZPASS, Cash, 1 or One, 2 or Two lanes.
     - These exclusions include variations like "lane", "lanes", "shoulder", and "median".
   - Status of lanes that are:
     - is closed, are closed, is blocked, are blocked, is currently closed, are currently closed, is currently blocked, are currently blocked.
     - Including variations like closed, closure, blocked.
   - Temporary closures:
     - The phrase "Closed temporarily".
   - Directional & multiple lane closures for:
     - one or 1 northbound or NB lane, two or 2 southbound or SB lane, etc.
     - These exclusions account for variations like is closed, are closed, is blocked, are blocked, is currently closed, are currently closed, is currently blocked, are currently blocked.
   - Reduced lane(s):
     - Descriptions stating lanes are closed to one or 1 lane, closed to two or 2 lanes.
     - Descriptions stating down to one or 1 lane, down to two or 2 lanes.
     - Phrases like "a lane closure", "single lane closure", "multiple lane closure(s)".

  ## License
This project is licensed under the MIT License. See the LICENSE file for details.
