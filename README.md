# m-hub

## Data hub for collecting and viewing material compositions of the City of Vienna's building stock

Data concerning the material composition of the building stock in Vienna is still very scarce. Various mixes of building materials have been used in a multitude of constructive ways, and significant changes were made over the years. This is a problem since those buildings nowadays act as candidates for demolition and new construction which accounts for 70% of annual waste in Austria; the building sector is furthermore accountable for 60% of all newly extracted resources and produces 40% of all energy-related CO2 emissions.

To make effective recycling and re-use possible and thus provide a significant contribution to the climate strategy, a comprehensive knowledge on material composition is needed. Until now property developers have conducted individual probing and surveying in such buildings without any plausibility analysis or "reality check" that takes similar buildings into account. Furthermore, the results of these activities are not used in subsequent projects, which is a pitty because re-using this data could inform a multitude of other stakeholders and furthermore could serve as a robust basis for a city-wide extrapolation.

We propose to develop a web-based platform that can inform property developers over likely material compositions for comparable buildings and furthermore offers the possibility to check own probes for plausibility. The idea works like a data hub in which participants enter probes/surveys in their own private area. The platform uses this data to learn to predict similar buildings in order to be able also asses buildings that have not yet been surveyed. Additionally the platform compares buildings with each other in order to conduct a plausibility check as feedback to each participant. The main benefit of this approach is that the hub gets more accurate over time since it continuously learns from its participants - which in turn acts as an incentive for participation. An neutral and open interface for material and re-use stores further contributes to the benefit. In the project, we also emphasize an integration with communal processes (e.g. building permit) and the provision of a repeatable data transformation workflow that can be used even after the project has ended.

The envisioned openly available solution is not only targeted at property developers, but also public administration i.e. the municipality, standardisation bodies, professional associations, research institutions and businesses that deal with circular economy (re-use and recycling). In the long term, operation of our platform is envisioned to shift to public bodies (City of Vienna IT; Chamber of Architects and Engineers) in order to ensure open participation.

---

## Setup Guide

Follow these steps to set up the project environment and import the building data:

1. **Download the data file**
    
    Download the file mhub_wien.gpkg from [TU Cloud](https://tucloud.tuwien.ac.at/index.php/f/1131545286) (m-hub/AP5-WEBAPP/mhub_wien.gpkg for internal members of the team; all others please request permission at stefan (punkt) bindreiter (ät) tuwien.ac.at) and place it inside the data folder.   

2. **Environment setup**

    Execute following command (depending on your platform) to copy `.env.example` to `.env`:

    ### Windows
    ```bash
    copy .env.example .env
    ```
    
    ### Mac / Linux
    ```bash
    cp .env.example .env
    ```   
    
    Then set the appropriate values for POSTGRES_PASSWORD and JWT_SECRET in the `.env` file.<br>
    For generating the JWT_SECRET something like `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` can be used.<br>

    You will also need a mapbox token: Go to mapbox.com, create an account, and follow the following procedure: [Setting up a mapbox token](https://docs.mapbox.com/help/dive-deeper/access-tokens/#creating-public-tokens). Paste the created token into your .env file as MAPBOX_TOKEN.

    Note: If you are on an ARM host, `deploy.sh` detects it and sets `DOCKER_PLATFORM=linux/amd64` for the PostGIS image.

2. **Pull latest sources**

    ```bash
    ./pull.sh
    ```

    On Windows, run the same command from Git Bash.

    > **Note for existing deploys:** `pull.sh` does not touch your local `.env`. After pulling, diff it against the template to pick up any new or changed variables:
    > ```bash
    > diff .env .env.example
    > ```
    > Apply any additions/renames manually (e.g. `SEAWEED_PUBLIC_BASE_URL=/files` was introduced and must be set on previously-deployed `.env` files).

3. **Build and deploy**

    ```bash
    ./deploy.sh
    ```

    This builds all Docker images, starts Postgres database, imports the GeoPackage, and brings up the rest of the stack.