function generateMap() {

    // var width = 1000, height = 800;
    // Define the dimensions of the SVG container based on the dimensions of the body
    var width = d3.select("body").node().getBoundingClientRect().width;
    var height = width * 0.6;

    // Define color to fill in the countries
    var countryColor = "#192841";
    // Create the SVG container
    var svg = d3.select("body").append('svg')
        .attr("width", width)
        .attr("height", height)
        .attr("style", "background-color: black");

    //Container for the gradient
    var defs = svg.append("defs");
    // Append two linear horizontal gradients with different directions
    // Depending on the location of the origin country wrt to target country (is it east of USA or west)
    // the flow lines will show gradient movement from left to right or right to left
    var linearGradientLR = defs
        .append("linearGradient")
        .attr("id", "lineGradientLR") //unique id for reference
        .attr("x1", "100%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "0")
        .attr("spreadMethod", "reflect");

    var linearGradientRL = defs
        .append("linearGradient")
        .attr("id", "lineGradientRL") //unique id for reference
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0")
        .attr("spreadMethod", "reflect");

    var gradientLineColors = ["#213586", "#33CD31"];

    //Append the colors evenly along the gradient
    linearGradientLR
        .selectAll(".stop")
        .data(gradientLineColors)
        .enter()
        .append("stop")
        .attr("offset", function (d, i) {
        return i / (gradientLineColors.length - 1);
        })
        .attr("stop-color", function (d) {
        return d;
        });
    //Append the colors evenly along the gradient
    linearGradientRL
        .selectAll(".stop")
        .data(gradientLineColors)
        .enter()
        .append("stop")
        .attr("offset", function (d, i) {
        return i / (gradientLineColors.length - 1);
        })
        .attr("stop-color", function (d) {
        return d;
        });

    // Define the map projection
    var projection = d3
        .geoNaturalEarth1()
        .scale(width / 5)
        .translate([width / 2, height / 2]);

    // Define the path generator
    var path = d3.geoPath().projection(projection);

    // Tooltip
    var tooltip = d3
        .select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("opacity", 0)
        .style("padding", "10px")
        .style("background", "rgba(0,0,0,0.6)")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("pointer-events", "none");
    
    d3.csv("SEVIS_2023_active.csv").then(function (data) {
        // Calculate total active students for each country
        var countryTotals = {};
        data.forEach(function (row) {
            countryTotals[row.COUNTRY.toLowerCase()] = +row["active_students"];
        });

        // Load and display the World
        d3.json("countries-50m.json").then(function (topology) {
            // Convert the TopoJSON to GeoJSON
            var geojson = topojson.feature(topology, topology.objects.countries);

            svg
                .selectAll(".country")
                .data(geojson.features)
                .enter()
                .append("path")
                .attr("class", "country")
                .attr("d", path)
                .attr("fill", countryColor)
                .attr("stroke", "#ffffff") // Adding stroke color (white in this case)
                .attr("stroke-width", "0.1")
                .on("mouseover", function (event, d) {
                d3.select(this).attr("fill", "#FF5733");
                let totalVal = countryTotals[d.properties.name.toLowerCase()];
                tooltip
                    .style("opacity", 1)
                    .html(
                    "Country: " +
                        d.properties.name +
                        "<br> Total: " +
                        (totalVal ? totalVal : 0)
                    )
                    .style("left", event.pageX + 10 + "px")
                    .style("top", event.pageY - 28 + "px");
                })
                .on("mouseout", function () {
                d3.select(this).attr("fill", countryColor);
                tooltip.style("opacity", 0);
                });

            // Extracting country "centroid" coordinates from GeoJSON
            var countryCoordinates = {};
            geojson.features.forEach(function (feature) {
                countryCoordinates[feature.properties.name.toLowerCase()] =
                d3.geoCentroid(feature);
            });

            // Determine the domain of the "Total" values
            var totalMin = d3.min(data, function (d) {
                return +d["active_students"];
            });
            var totalMax = d3.max(data, function (d) {
                return +d["active_students"];
            });

            // Create a scale function to map "Total" values to line widths
            var lineWidthScale = d3
                .scaleSqrt()
                .domain([totalMin, totalMax])
                .range([0, 10]);

            // For each row in the data, draw a line from the country to the USA
            // CAN MODIFY THIS PART TO DRAW LINES TO ANY OTHER COUNTRY
            data.forEach(function (row) {
                var countryName = row.COUNTRY.toLowerCase();
                var total = +row["active_students"];
                var coordinates = countryCoordinates[countryName];
                if (coordinates) {
                // If the country is in the GeoJSON data
                var lineData = [
                    coordinates,
                    countryCoordinates["united states of america"]
                ];
                drawLine(lineData, lineWidthScale(total));
                // Draw circle at origin country
                // Circle radius depends on the total "active students" from that country
                drawCircle(coordinates, lineWidthScale(total));
                }
            });
        }).catch(function (error) {
            console.log("Error loading topo json data: " + error);
        });

        // Function to draw circle
        function drawCircle(coordinates, circleRadius) {
            svg
            .append("circle")
            .attr("cx", projection(coordinates)[0])
            .attr("cy", projection(coordinates)[1])
            .attr("r", circleRadius * (Math.min(width, height) / 500)) // Keeping the radius dynamic based on width of the screen
            .attr("fill", "red");
        }

        // Function to draw line
        function drawLine(coordinates, lineWidth) {
            // Define line generator
            var lineGenerator = d3
            .line()
            .x(function (d) {
                return projection(d)[0];
            })
            .y(function (d) {
                return projection(d)[1];
            });

            // See if the animation should flow from left to right or right to left!
            var gradientId =
            projection(coordinates[0])[0] > projection(coordinates[1])[0]
                ? "lineGradientRL"
                : "lineGradientLR";

            // Draw the line
            svg
            .append("path")
            .datum(coordinates)
            .attr("d", lineGenerator)
            .attr("stroke", "url(#" + gradientId + ")")
            .attr("stroke-width", lineWidth * (Math.min(width, height) / 1200))
            .attr("fill", "none");

            linearGradientLR
            .append("animate")
            .attr("attributeName", "x1")
            .attr("values", "0%;200%") // Modify these values to create a smoother/different gradient flow
            .attr("dur", "3s")
            .attr("repeatCount", "indefinite");

            linearGradientLR
            .append("animate")
            .attr("attributeName", "x2")
            .attr("values", "100%;300%")
            .attr("dur", "3s")
            .attr("repeatCount", "indefinite");

            linearGradientRL
            .append("animate")
            .attr("attributeName", "x1")
            .attr("values", "100%;-100%") // let x1 run from 100% to -100%
            .attr("dur", "3s")
            .attr("repeatCount", "indefinite");

            linearGradientRL
            .append("animate")
            .attr("attributeName", "x2")
            .attr("values", "200%;0%") // let x2 run from 200% to 0%
            .attr("dur", "3s")
            .attr("repeatCount", "indefinite");
        }      
    }).catch(function (error) {
        console.log("Error loading file data: " + error);
    });
}

