/**
 * Helper functions for working with routes and stops.  These are used to filter out
 * routes, spurious directions, and idiosyncratic stops when listing and scoring entire routes.
 *
 * Also includes functions for computing distances between coordinates.
 */

import * as d3 from 'd3';
import red from '@material-ui/core/colors/red';
import green from '@material-ui/core/colors/green';
import yellow from '@material-ui/core/colors/yellow';
import lightGreen from '@material-ui/core/colors/lightGreen';

import { getAgency } from '../config';

export function isIgnoredRoute(route) {
  const routeHeuristics = getAgency(route.agencyId).routeHeuristics;
  return (
    routeHeuristics &&
    routeHeuristics[route.id] &&
    routeHeuristics[route.id].ignoreRoute
  );
}

/**
 * Given an array of routes, return only the routes we want to show.
 */
export function filterRoutes(routes) {
  return routes.filter(route => {
    return !isIgnoredRoute(route);
  });
}

/**
 *
 * @param meters
 * @returns Conversion from meters to miles.
 */
export function metersToMiles(meters) {
  return meters / 1609.344;
}

/**
 * Score computation.
 *
 * TODO: refactor with Info.jsx's computation of grades once we add in probability
 * of long wait and travel variability to RouteSummary.
 */
export function computeScores(medianWait, onTimeRate, speed, variability) {
  const medianWaitScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);

  const onTimeRateScoreScale = d3
    .scaleLinear()
    .domain([1, 0])
    .rangeRound([100, 0])
    .clamp(true);

  const speedScoreScale = d3
    .scaleLinear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);

  // score for travel time variability
  // where variability is 90th percentile trip time minus 10th percentile trip time

  const variabilityScoreScale = d3
    .scaleLinear()
    .domain([10, 20])
    .rangeRound([100, 0])
    .clamp(true);

  const medianWaitScore =
    medianWait != null ? medianWaitScoreScale(medianWait) : null;
  const onTimeRateScore =
    onTimeRate != null ? onTimeRateScoreScale(onTimeRate) : null;
  const speedScore = speed != null ? speedScoreScale(speed) : null;
  const travelVarianceScore =
    variability != null ? variabilityScoreScale(variability) : null;

  const totalScore =
    medianWaitScore != null &&
    onTimeRateScore != null &&
    speedScore != null &&
    travelVarianceScore != null
      ? Math.round(
          (medianWaitScore +
            onTimeRateScore +
            speedScore +
            travelVarianceScore) /
            4.0,
        )
      : null;

  return {
    medianWaitScore,
    onTimeRateScore,
    speedScore,
    travelVarianceScore,
    totalScore,
  };
}

export const HighestPossibleScore = 100;

const backgroundColorScale = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range([red[300], yellow[300], lightGreen[700], green[900]]);

export const scoreBackgroundColor = score => {
  if (score == null || Number.isNaN(score)) {
    return null;
  }
  return backgroundColorScale(score / HighestPossibleScore);
};

const contrastColorScale = d3
  .scaleThreshold()
  .domain([0.25, 0.5, 0.75])
  .range(['rgba(0,0,0,0.87)', 'rgba(0,0,0,0.87)', 'white', 'white']);

export const scoreContrastColor = score => {
  if (score == null || Number.isNaN(score)) {
    return null;
  }
  return contrastColorScale(score / HighestPossibleScore);
};

/**
 * Haversine formula for calcuating distance between two coordinates in lat lon
 * from bird eye view; seems to be +- 8 meters difference from geopy distance.
 *
 * From eclipses.py.  Returns distance in meters.
 */
export function haverDistance(degLatStop, degLonStop, degLatBus, degLonBus) {
  const deg2rad = x => (x * Math.PI) / 180;
  const eradius = 6371000;

  const [radLatStop, radLonStop, radLatBus, radLonBus] = [
    degLatStop,
    degLonStop,
    degLatBus,
    degLonBus,
  ].map(deg2rad);

  const latDiff = radLatBus - radLatStop;
  const lonDiff = radLonBus - radLonStop;

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(radLatStop) * Math.cos(radLatBus) * Math.sin(lonDiff / 2) ** 2;
  const hypotenuse = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = eradius * hypotenuse;

  return distance;
}

/**
 * Returns the distance between two stops in miles.
 */
export function milesBetween(p1, p2) {
  const meters = haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  return metersToMiles(meters);
}

export function addRanks(
  statsArr,
  property,
  sortFactor,
  rankProperty,
  rankCountProperty,
) {
  const rankedStats = statsArr.filter(stats => stats[property] != null);
  rankedStats.sort((a, b) => {
    return (a[property] - b[property]) * sortFactor;
  });

  const rankCount = rankedStats.length;
  rankedStats.forEach(function(stats, index) {
    stats[rankProperty] = index + 1;
    stats[rankCountProperty] = rankCount;
  });
}
