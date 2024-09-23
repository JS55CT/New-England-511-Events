function process_NE511_ME_XmlFeed_to_Discord() {
  NE511_ME_incidentData_XmlFeed_to_Discord();
  NE511_ME_laneClosureData_XmlFeed_to_Discord();
}
//Pass anything with the following key words.
var postPatternME = /\b(closed|closure|blocked|blocking|flooded|tree in|water over|shut\s+down|all\s+lanes|both\s+lanes|across\s+the\s+(road|street))\b/i

// Then filter out anything that is Lane spacific.
var exclusionPatternME = /(?:\b(Lane\s+(1|2|3|4|one|two|three|four))|((Right|Left|Center|ORT|EZ\s+PASS|EZPASS|cash|shoulder|median|1|one|2|two|3|three|Right\s+Turn|Left\s+Turn)\s+lane(s)?|(shoulder|median))\s+(is\s+|are\s+)?(currently\s+)?(closed|closure|blocked)|Closed\s+temporarily|\b(one|1|two|2)\s+(northbound|southbound|eastbound|westbound|NB|SB|EB|WB)\s+lane\s+(is\s+|are\s+)?(currently\s+)?(closed|blocked)|closed\s+to\s+(one|1|two|2|Marine\s+traffic)\s+lane|down\s+to\s+(one|1|two|2)\s+Lane|closed\s+to\s+Marine\s+traffic|(?:a|single|multiple|rolling)?\s*lane\s+closures?|rolling\s+closure|rolling\s+roadblock)\b/i;

function NE511_ME_incidentData_XmlFeed_to_Discord() {
  // Initialize counters
  var postedCount = 0;
  var skippedCount = 0;

  // URL of the XML source
  var url = 'https://nec-por.ne-compass.com/XmlDataPortalV2/api/c2c?networks=Maine&dataTypes=incidentData'; // New URL updated 3-25-2024
  var me_webohok = 'ENTER_WEBHOOK_URL_HERE'

  // Fetch the XML Data
  var response = UrlFetchApp.fetch(url);

  // Parse fetched XML data into a document
  var xmlData = response.getContentText();

  // Parse fetched XML data into a document
  var document = XmlService.parse(xmlData);

  // Define the namespace based on the one used in the XML document
  var ns = XmlService.getNamespace('http://its.gov/c2c_icd');

  // Get root element of the XML document
  var rootElement = document.getRootElement();

  // Get 'incidentData' element from root
  var incidentDataElement = rootElement.getChild('incidentData', ns);

  // Get 'net' element (assuming there's only one 'net' element)
  var netElement = incidentDataElement ? incidentDataElement.getChild('net', ns) : null;

  // Get "incident" elements from 'net' if it exists
  var incidents = netElement ? netElement.getChildren('incident', ns) : [];

  // Check whether incidents were fetched
  Logger.log('Number of incidents: ' + incidents.length);

  // Retrieve the last run time of the script from properties or use 0 if it's the first time
  var lastRunTime = PropertiesService.getScriptProperties().getProperty('NE_511_ME_incidentData_lastRunTime');
  lastRunTime = lastRunTime ? new Date(lastRunTime) : new Date(0);

  // Get the current time
  var currentTime = new Date();

  // forEach function for each 'incident' element
  incidents.forEach(function (incident) {

    // Fetch the 'id' attribute
    var idAttr = incident.getAttribute('id');
    var id = idAttr ? idAttr.getValue() : null;

    // Fetch the 'createdTimestamp' element
    var createdTimestampElement = incident.getChild('createdTimestamp', ns);
    var createdTime = null;

    if (createdTimestampElement) {
      var timestampText = createdTimestampElement.getText();
      // Only parse the date if we have a timestamp text
      if (timestampText) {
        createdTime = new Date(timestampText); // Parse the text into a Date object

        // Validate the createdTime to ensure it is a valid date
        if (isNaN(createdTime.getTime())) {
          Logger.log('Invalid date encountered in createdTimestamp.');
          createdTime = null; // Reset to null if the date is invalid
        }
      }
    }

    // Only process the incidents that start after the last script run time and are not future-dated or have not been posted before
    if ((createdTime > lastRunTime)) {

      // Get the incident description
      var description = incident.getChild('desc', ns).getText();
      if (!description) return;

      // Check if it matches the post pattern
      if (postPatternME.test(description)) {
        // Now check for exclusion criteria
        if (exclusionPatternME.test(description)) {
          Logger.log('Incident ID: ' + id + ' Created Time: ' + createdTime + ' Skipped due to exclusion: ' + description);
          skippedCount++;
          return;
        }

        // Get the start location and nested elements such as 'lat' and 'lon'
        var startLocation = incident.getChild('startLocation', ns);
        var firstLat = startLocation ? startLocation.getChild('lat', ns).getText() : null;
        if (firstLat !== null) {
          firstLat = (parseInt(firstLat, 10) / 1000000).toFixed(6);
        }
        var firstLon = startLocation ? startLocation.getChild('lon', ns).getText() : null;
        if (firstLon !== null) {
          firstLon = (parseInt(firstLon, 10) / 1000000).toFixed(6);
        }

        // Possible handling for end location, if it exists in the XML
        var endLocation = incident.getChild('endLocation', ns);
        var lastLat = endLocation ? endLocation.getChild('lat', ns).getText() : null;
        if (lastLat !== null) {
          lastLat = (parseInt(lastLat, 10) / 1000000).toFixed(6);
        }
        var lastLon = endLocation ? endLocation.getChild('lon', ns).getText() : null;
        if (lastLon !== null) {
          lastLon = (parseInt(lastLon, 10) / 1000000).toFixed(6);
        }

        // If there is a start location, build the WME URL for the starting point
        var wmefirstPairUrl = firstLat && firstLon
          ? `https://waze.com/en-US/editor?env=usa&lat=${firstLat}&lon=${firstLon}&zoom=6&marker=true`
          : '';

        // If there is an end location, build the WME URL for the ending point
        var wmelastPairUrl = lastLat && lastLon
          ? `https://waze.com/en-US/editor?env=usa&lat=${lastLat}&lon=${lastLon}&zoom=6&marker=true`
          : '';

        // Get the 'roadway' element text from 'startLocation' child if available
        var street = startLocation ? startLocation.getChild('roadway', ns).getText() : '[Unknown Roadway]';
        var city = startLocation ? startLocation.getChild('city', ns).getText() : '[Unknown]';
        var type = incident.getChild('eventType', ns).getText();

        // Format the start and end times for display in Discord message body
        var timezone = 'America/New_York';
        var format = "MMM dd, yyyy HH:mm a 'ET'";
        //var createdTimeformat = Utilities.formatDate(createdTime, timezone, format);
        var createdTimeformat = (createdTime && !isNaN(createdTime.getTime())) ? Utilities.formatDate(createdTime, timezone, format) : 'N/A';

        // Initialize the description with mandatory parts
        var descriptionText = '';
        // Add event created time if available
        if (createdTimeformat) {
          descriptionText += `Event Created: ${createdTimeformat}\n\n`;
        }

        // Add the general description if available
        if (description) {
          descriptionText += `${description}`;
        }

        // Add the starting point link if available
        if (wmefirstPairUrl) {
          descriptionText += `\n\n[WME:Starting point](${wmefirstPairUrl})`;
        }

        // Add separator if both URLs are present
        if (wmefirstPairUrl && wmelastPairUrl) {
          descriptionText += ' | ';
        }

        // Add the ending point link if available
        if (wmelastPairUrl) {
          descriptionText += `[WME:Ending point](${wmelastPairUrl})`;
        }


        // Construct the payload message for Discord
        var payload = JSON.stringify({
          username: 'NE 511 - Maine',
          avatar_url: 'https://newengland511.org/Content/NE/Images/New-England-Logo.png',
          content: '',
          tts: false,
          embeds: [{
            type: 'rich',
            title: `Incident Alert for ${street} , ${city}`,
            description: descriptionText,
            color: 0xFFF200,
            timestamp: createdTime ? createdTime.toISOString() : null, // createdTime
            thumbnail: {
              url: 'https://newengland511.org/Content/NE/Images/New-England-Logo.png',
            },
            url: `https://newengland511.org/map#Incidents-Maine511Incident--${id}`,
            author: {
              name: 'New England 511',
              url: 'https://newengland511.org/',
            },
            footer: {
              text: ''
            },
            fields: [{
              name: 'ALERT TYPE',
              value: type,
              inline: true
            }]
          }]
        });

        var params = {
          method: "POST",
          payload: payload,
          muteHttpExceptions: true,
          contentType: "application/json"
        };

        UrlFetchApp.fetch(me_webohok, params);
        Logger.log('incident ID: ' + id + ' Created Time: ' + createdTime + ' Posted: ' + description)
        postedCount++;

      } else {
        Logger.log('Incident ID: ' + id + ' Created Time: ' + createdTime + ' No match for post pattern: ' + description);
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  });

  // After all incidents have been processed, log the results
  Logger.log('Posted incidents: ' + postedCount);
  Logger.log('Skipped incidents: ' + skippedCount);

  // Store the current time as the last run time
  PropertiesService.getScriptProperties().setProperty('NE_511_ME_incidentData_lastRunTime', currentTime.toISOString());
}

function NE511_ME_laneClosureData_XmlFeed_to_Discord() {
  // Initialize counters
  var postedCount = 0;
  var skippedCount = 0;

  // URL of the XML source
  var url = 'https://nec-por.ne-compass.com/XmlDataPortalV2/api/c2c?networks=Maine&dataTypes=laneClosureData'; // New URL updated 3-25-2024
  var me_webohok = 'ENTER_WEBHOOK_URL_HERE'; // NER --> ME --> ME Twitter --> NE 511 Webhook

  // Fetch the XML Data
  var response = UrlFetchApp.fetch(url);

  // Parse fetched XML data into a document
  var xmlData = response.getContentText();

  // Parse fetched XML data into a document
  var document = XmlService.parse(xmlData);

  // Define the namespace based on the one used in the XML document
  var ns = XmlService.getNamespace('http://its.gov/c2c_icd');

  // Get root element of the XML document
  var rootElement = document.getRootElement();

  // Get 'incidentData' element from root
  var incidentDataElement = rootElement.getChild('laneClosureData', ns);

  // Get 'net' element (assuming there's only one 'net' element)
  var netElement = incidentDataElement ? incidentDataElement.getChild('net', ns) : null;

  // Get "incident" elements from 'net' if it exists
  var incidents = netElement ? netElement.getChildren('laneClosure', ns) : [];

  // Check whether incidents were fetched
  Logger.log('Number of incidents: ' + incidents.length);

  // Retrieve the last run time of the script from properties or use 0 if it's the first time
  var lastRunTime = PropertiesService.getScriptProperties().getProperty('NE_511_ME_laneClosureData_lastRunTime');
  lastRunTime = lastRunTime ? new Date(lastRunTime) : new Date(0);

  // Get the current time
  var currentTime = new Date();

  // forEach function for each 'incident' element
  incidents.forEach(function (incident) {

    // Fetch the 'id' attribute
    var idAttr = incident.getAttribute('id');
    var id = idAttr ? idAttr.getValue() : null;

    // Fetch the 'createdTimestamp' element
    var createdTimestampElement = incident.getChild('createdTimestamp', ns);
    var createdTime = null;

    if (createdTimestampElement) {
      var timestampText = createdTimestampElement.getText();
      // Only parse the date if we have a timestamp text
      if (timestampText) {
        createdTime = new Date(timestampText); // Parse the text into a Date object

        // Validate the createdTime to ensure it is a valid date
        if (isNaN(createdTime.getTime())) {
          Logger.log('Invalid date encountered in createdTimestamp.');
          createdTime = null; // Reset to null if the date is invalid
        }
      }
    }

    // Only process the incidents that where created after the last script run time!
    if ((createdTime > lastRunTime)) {
      // Get the incident description
      var description = incident.getChild('desc', ns).getText();
      if (!description) return;

      // Check if it matches the post pattern
      if (postPatternME.test(description)) {
        // Now check for exclusion criteria
        if (exclusionPatternME.test(description)) {
          Logger.log('Incident ID: ' + id + ' Created Time: ' + createdTime + ' Skipped due to exclusion: ' + description);
          skippedCount++;
          return;
        }
        // Get the start location and nested elements such as 'lat' and 'lon'
        var startLocation = incident.getChild('startLocation', ns);
        var firstLat = startLocation ? startLocation.getChild('lat', ns).getText() : null;
        if (firstLat !== null) {
          firstLat = (parseInt(firstLat, 10) / 1000000).toFixed(6);
        }
        var firstLon = startLocation ? startLocation.getChild('lon', ns).getText() : null;
        if (firstLon !== null) {
          firstLon = (parseInt(firstLon, 10) / 1000000).toFixed(6);
        }

        // Possible handling for end location, if it exists in the XML
        var endLocation = incident.getChild('endLocation', ns);
        var lastLat = endLocation ? endLocation.getChild('lat', ns).getText() : null;
        if (lastLat !== null) {
          lastLat = (parseInt(lastLat, 10) / 1000000).toFixed(6);
        }
        var lastLon = endLocation ? endLocation.getChild('lon', ns).getText() : null;
        if (lastLon !== null) {
          lastLon = (parseInt(lastLon, 10) / 1000000).toFixed(6);
        }

        // Added Event Start Date and Time and Event End Data and Time if avaliable.
        var startTimeElement = incident.getChild('startTime', ns);
        var startDateElement = incident.getChild('startDate', ns);
        var startTimeText = startTimeElement ? startTimeElement.getText() : null;
        var startDateText = startDateElement ? startDateElement.getText() : null;
        var startDateTime = null;

        if (startTimeText && startDateText) {
          // Assuming the startDate is in MM/DD/YYYY format and startTime is in HH:mm:ss format
          // Combine the date and time strings into a single string
          var startDateTimeStr = startDateText + ' ' + startTimeText;

          // Parse the combined string into a Date object
          startDateTime = new Date(startDateTimeStr);

          // Validate the resulting Date object
          if (isNaN(startDateTime.getTime())) {
            Logger.log('Invalid start date/time encountered.');
            startDateTime = null;
          }
        }

        var endTimeElement = incident.getChild('endTime', ns);
        var endDateElement = incident.getChild('endDate', ns);
        var endTimeText = endTimeElement ? endTimeElement.getText() : null;
        var endDateText = endDateElement ? endDateElement.getText() : null;
        var endDateTime = null;

        if (endTimeText && endDateText) {
          // Assuming the endDate is in MM/DD/YYYY format and endTime is in HH:mm:ss format
          // Combine the date and time strings into a single string
          var endDateTimeStr = endDateText + ' ' + endTimeText;

          // Parse the combined string into a Date object
          endDateTime = new Date(endDateTimeStr);

          // Validate the resulting Date object
          if (isNaN(endDateTime.getTime())) {
            Logger.log('Invalid end date/time encountered.');
            endDateTime = null;
          }
        }

        // If there is a start location, build the WME URL for the starting point
        var wmefirstPairUrl = firstLat && firstLon
          ? `https://waze.com/en-US/editor?env=usa&lat=${firstLat}&lon=${firstLon}&zoom=6&marker=true`
          : '';

        // If there is an end location, build the WME URL for the ending point
        var wmelastPairUrl = lastLat && lastLon
          ? `https://waze.com/en-US/editor?env=usa&lat=${lastLat}&lon=${lastLon}&zoom=6&marker=true`
          : '';

        // Get the 'roadway' element text from 'startLocation' child if available
        var street = startLocation ? startLocation.getChild('roadway', ns).getText() : '[Unknown Roadway]';
        var city = startLocation ? startLocation.getChild('city', ns).getText() : '[Unknown]';
        var type = incident.getChild('eventType', ns).getText();

        // Format the createdTime , start and end times for display in Discord message body
        var timezone = 'America/New_York';
        var format = "MMM dd, yyyy hh:mm a 'ET'";
        var createdTimeformat = (createdTime && !isNaN(createdTime.getTime())) ? Utilities.formatDate(createdTime, timezone, format) : 'N/A';
        var startDateTimeformat = (startDateTime && !isNaN(startDateTime.getTime())) ? Utilities.formatDate(startDateTime, timezone, format) : 'N/A';
        var endDateTimeformat = (endDateTime && !isNaN(endDateTime.getTime())) ? Utilities.formatDate(endDateTime, timezone, format) : 'N/A';

        // Initialize the description with mandatory parts
        var descriptionText = '';

        // Add event start time if available
        if (startDateTimeformat) {
          descriptionText += `Event Start: ${startDateTimeformat}\n`;
        }

        // Add event end time if available
        if (endDateTimeformat) {
          descriptionText += `Event End: ${endDateTimeformat}\n\n`;
        }

        // Add event created time if available
        if (createdTimeformat) {
          descriptionText += `Event Created: ${createdTimeformat}\n\n`;
        }

        // Add the general description if available
        if (description) {
          descriptionText += `${description}`;
        }

        // Add the starting point link if available
        if (wmefirstPairUrl) {
          descriptionText += `\n\n[WME:Starting point](${wmefirstPairUrl})`;
        }

        // Add separator if both URLs are present
        if (wmefirstPairUrl && wmelastPairUrl) {
          descriptionText += ' | ';
        }

        // Add the ending point link if available
        if (wmelastPairUrl) {
          descriptionText += `[WME:Ending point](${wmelastPairUrl})`;
        }

        // Construct the payload message for Discord
        var payload = JSON.stringify({
          username: 'NE 511 - Maine',
          avatar_url: 'https://newengland511.org/Content/NE/Images/New-England-Logo.png',
          content: '',
          tts: false,
          embeds: [{
            type: 'rich',
            title: `Alert for ${street} , ${city}`,
            description: descriptionText,
            color: 0xFFF200,
            timestamp: createdTime ? createdTime.toISOString() : null,
            thumbnail: {
              url: 'https://newengland511.org/Content/NE/Images/New-England-Logo.png',
            },
            url: `https://newengland511.org/map#ConstructionClosures-Maine511Closure--${id}`,
            author: {
              name: 'New England 511',
              url: 'https://newengland511.org/',
            },
            footer: {
              text: ''
            },
            fields: [{
              name: 'ALERT TYPE',
              value: type,
              inline: true
            }]
          }]
        });

        var params = {
          method: "POST",
          payload: payload,
          muteHttpExceptions: true,
          contentType: "application/json"
        };

        UrlFetchApp.fetch(me_webohok, params);
        Logger.log('incident ID: ' + id + ' Created Time: ' + createdTime + ' Posted: ' + description)

        postedCount++;
      } else {
        Logger.log('Incident ID: ' + id + ' Created Time: ' + createdTime + ' No match for post pattern: ' + description);
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  });

  // After all incidents have been processed, log the results
  Logger.log('Posted incidents: ' + postedCount);
  Logger.log('Skipped incidents: ' + skippedCount);

  // Replace the futureStartIds in PropertiesService with the IDs for incidents with a start time in the future
  //PropertiesService.getScriptProperties().setProperty('NE_511_VT_laneClosureData_futureStartIds', JSON.stringify(currentFutureIds));

  //Logger.log('Total future incidents rolling over to next run: ' + Object.keys(currentFutureIds).length);

  // Store the current time as the last run time
  PropertiesService.getScriptProperties().setProperty('NE_511_ME_laneClosureData_lastRunTime', currentTime.toISOString());
}
