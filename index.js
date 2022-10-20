const { groupBy, sortBy, reverse } = require("lodash");
const fs = require("fs");
const path = require("path");

const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const reset = "\x1b[0m";

const ROOT = process.env.ROOT || ".";
const bundlePath = path.join(ROOT, ".next/analyze/client.html");

console.log(`Analyzing browser bundle from ${bundlePath}.`);

console.log(
  "Sizes shown are for minified and tree-shaken files (before compression)."
);

const chartDataRegex =
  /<script>\s+window\.chartData = (.*);\s+window\.defaultSizes/;

const clientHtml = fs.readFileSync(bundlePath, "utf8").replaceAll("\n", "");

const dataRaw = chartDataRegex.exec(clientHtml)[1];

const dataParsed = JSON.parse(dataRaw);

function getItemsFromGroups(groups) {
  return groups.flatMap(getItems);
}

function getItems(group) {
  if (group.groups && group.groups.length > 0) {
    return getItemsFromGroups(group.groups);
  } else if (group.path) {
    // parsedSize is missing for CSS files
    return [{ path: group.path, size: group.parsedSize || group.statSize }];
  } else {
    return [];
  }
}

const allItems = getItemsFromGroups(dataParsed);

const concatenatedRegex = / \+ [0-9]+ modules \(concatenated\)/g;

const items = allItems
  .flatMap((item) => {
    const [concatenated, submodules] = item.path.split(concatenatedRegex);

    return [
      { path: submodules ? `.${submodules}` : concatenated, size: item.size },
    ];
  })
  .filter((x) => x.path.includes("./node_modules/.pnpm/"))
  // bundle analyzer produces incorrect paths to node_modules when target is
  // a different directory than the root
  .map((item) => ({
    ...item,
    path: item.path.replace(/^.*?node_modules/, "./node_modules"),
  }));

items.forEach((item) => {
  if (!fs.existsSync(item.path)) {
    throw new Error(`${item.path} does not exist`);
  }

  if (!item.path.startsWith("./node_modules/.pnpm/")) {
    throw new Error(`${item.path} is not in the node_modules directory`);
  }

  if (!item.path) {
    throw new Error(`${item.path} is not a valid item`);
  }
});

const itemRegex =
  /(\.\/node_modules\/\.pnpm\/([@\.A-Za-z0-9-+_]+)\/node_modules\/(((@[\.A-Za-z0-9-+_]+)\/([\.A-Za-z0-9-+_]+))|([\.A-Za-z0-9-+_]+)))/;

const filesByPackage = groupBy(items, (item) => {
  return itemRegex.exec(item.path)[0];
});

const packageWithVersions = Object.keys(filesByPackage).map((path) => {
  const packageJson = JSON.parse(
    fs.readFileSync(path + "/package.json", "utf8")
  );

  const version = packageJson.version;
  const name = packageJson.name;

  return {
    path,
    name,
    version,
    files: filesByPackage[path],
  };
});

const packagesGroupedByName = groupBy(
  packageWithVersions,
  (package) => package.name
);

const packageBuckets = {
  duplicates: [],
  unique: [],
};

for (key in packagesGroupedByName) {
  const packages = packagesGroupedByName[key];

  if (packages.length > 1) {
    const size = sum(packages.map(getPackageSize));

    packageBuckets.duplicates.push({
      packages,
      size,
      savings: size / packages.length,
    });
  } else {
    packageBuckets.unique.push(packages[0]);
  }
}

function formatSizeKB(size) {
  return `${size > 20000 ? red : yellow}${(size / 1024).toFixed(2)} KB${reset}`;
}

function sum(items) {
  return items.reduce((acc, item) => acc + item, 0);
}

function getPackageSize(package) {
  return sum(package.files.map(({ size }) => size));
}

console.log(
  `Total size of all node_modules, minified: ${yellow}${formatSizeKB(
    sum(items.map((item) => item.size))
  )}${reset}`
);

console.log();

if (packageBuckets.duplicates.length > 0) {
  console.log(
    `${red}${packageBuckets.duplicates.length} duplicate packages found.${reset}`
  );

  const savings = sum(
    packageBuckets.duplicates.map((package) => package.savings)
  );

  console.log(`Estimated size wasted: ${red}${formatSizeKB(savings)}${reset}`);
} else {
  console.log(`${green}No duplicate packages found.${reset}`);
}

console.log();

reverse(
  sortBy(packageBuckets.duplicates, (duplicates) => duplicates.size)
).forEach(({ packages }) => {
  console.log(`${packages[0].name} has ${packages.length} versions:`);

  packages.forEach((package) => {
    console.log(
      `  ${package.version} (${formatSizeKB(getPackageSize(package))}) (in ${
        package.path
      })`
    );

    if (package.files.length > 1) {
      reverse(sortBy(package.files, (file) => file.size)).forEach((file) => {
        console.log(`    ${formatSizeKB(file.size)} (${file.path})`);
      });

      console.log();
    }
  });

  console.log();
});

reverse(sortBy(packageBuckets.unique, getPackageSize)).forEach((package) => {
  console.log(`${package.name} has a single version:`);

  console.log(
    `${package.version} (${formatSizeKB(getPackageSize(package))}) (in ${
      package.path
    })`
  );

  if (package.files.length > 1) {
    reverse(sortBy(package.files, (file) => file.size)).forEach((file) => {
      console.log(`    ${formatSizeKB(file.size)} (${file.path})`);
    });
  }

  console.log();
});
