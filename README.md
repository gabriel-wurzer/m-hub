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

    Frontend branding can be selected in `.env`:

    ```env
    FRONTEND_BRANDING=default
    HIDE_NAME_SECTION=false
    ```

    `FRONTEND_BRANDING` must match a folder in `m-hub-frontend/customization/`.
    `HIDE_NAME_SECTION=true` hides the name section in the menu bar for the deployed frontend.

    Note: If you are on an ARM host, `deploy.sh` detects it and sets `DOCKER_PLATFORM=linux/amd64` for the PostGIS image.

3. **Pull latest sources**

    ```bash
    ./pull.sh
    ```

    On Windows, run the same command from Git Bash.

    > **Note for existing deploys:** `pull.sh` does not touch your local `.env`. After pulling, diff it against the template to pick up any new or changed variables:
    > ```bash
    > diff .env .env.example
    > ```
    > Apply any additions/renames manually (e.g. `SEAWEED_PUBLIC_BASE_URL=/files` was introduced and must be set on previously-deployed `.env` files).

4. **Build and deploy**

    ```bash
    ./deploy.sh
    ```

    This builds all Docker images, starts Postgres database, imports the GeoPackage, and brings up the rest of the stack.

---

## Frontend customization / branding

The frontend supports switchable branding through folders in:

```text
m-hub-frontend/customization/<branding-name>/
```

The active branding is selected with `FRONTEND_BRANDING` in `.env`. During `npm run start`, `npm run build`, and Docker builds, `m-hub-frontend/scripts/apply-branding.js` applies the selected branding before Angular starts or builds.

Currently supported `.env` flags:

```env
# Must match a folder below m-hub-frontend/customization/.
FRONTEND_BRANDING=default

# Hides the vertical name section in the menu bar when true.
HIDE_NAME_SECTION=false
```

Available branding folders currently include:

```text
m-hub-frontend/customization/default/
m-hub-frontend/customization/materialnomaden/
```

Each customization folder must contain:

```text
_theme-setup.scss
branding.json
```

Recommended optional files:

```text
logo.svg
favicon.ico
imprint.html
privacy.html
logos/
```

All files and folders inside the selected customization folder are copied to:

```text
m-hub-frontend/src/assets/branding/
```

`_theme-setup.scss` is copied separately to:

```text
m-hub-frontend/src/_theme-setup.generated.scss
```

`favicon.ico` is copied to `src/assets/branding/favicon.ico`. If the selected branding does not contain a favicon, the default favicon is used when available.

The `branding.json` shape is:

```json
{
  "appName": "m-hub",
  "logoPath": "/assets/branding/logo.svg",
  "menuLetters": ["m", "h", "u", "b"]
}
```

Fields:

- `appName`: Used for the browser title during branding application.
- `logoPath`: Path used by the menu logo. Prefer `/assets/branding/logo.svg`.
- `menuLetters`: Optional vertical menu-name letters. Omit it or set it to an empty array to render no name section for that branding.

The branding script also:

- appends content hashes to the logo and favicon URLs for cache busting;
- updates the browser title in `src/index.html`;
- updates the favicon link in `src/index.html`;
- updates the logo preload link in `src/index.html`;
- recolors SVGs in `src/assets/images/` when `$svg-asset-color` is defined in the selected `_theme-setup.scss`;
- writes `src/environments/asset-versions.generated.ts` so SVG usages can be cache-busted after recoloring.
