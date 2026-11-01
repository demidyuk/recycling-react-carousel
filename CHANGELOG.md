## [2.0.1](https://github.com/demidyuk/recycling-react-carousel/compare/v2.0.0...v2.0.1) (2026-11-01)


### Bug Fixes

* correct Storybook links ([6ec2b05](https://github.com/demidyuk/recycling-react-carousel/commit/6ec2b05c87fb14b6188b089141331147d764b434))

# [2.0.0](https://github.com/demidyuk/recycling-react-carousel/compare/v1.3.2...v2.0.0) (2026-11-01)


### Features

* introduce the v2 carousel API ([533ebf5](https://github.com/demidyuk/recycling-react-carousel/commit/533ebf59ec4631d459b396290ffedbfe80b2a8e2))


### BREAKING CHANGES

* Replace legacy hooks and configuration with useCarousel
and component props. Require React 18 or 19 and Node.js >=22.18.0.

# [2.0.0-alpha.3](https://github.com/demidyuk/recycling-react-carousel/compare/v2.0.0-alpha.2...v2.0.0-alpha.3) (2026-11-01)


### Bug Fixes

* keep visible slides interactive during animation ([1e70420](https://github.com/demidyuk/recycling-react-carousel/commit/1e70420401f5986def28a3f556dcb2cac4bf2713))

# [2.0.0-alpha.2](https://github.com/demidyuk/recycling-react-carousel/compare/v2.0.0-alpha.1...v2.0.0-alpha.2) (2026-11-01)


### Features

* add momentum snapping and motion subscriptions ([9678626](https://github.com/demidyuk/recycling-react-carousel/commit/96786265ec33b3bbe26b6e2d9d37b3e8d30e842f))

# [2.0.0-alpha.1](https://github.com/demidyuk/recycling-react-carousel/compare/v1.3.2...v2.0.0-alpha.1) (2026-11-01)


* feat!: introduce the v2 carousel architecture and API ([b456bab](https://github.com/demidyuk/recycling-react-carousel/commit/b456bab90348752de8dd1a82c4afa88de4a8c2a5))
* feat!: introduce the v2 carousel architecture and API ([2c41ce2](https://github.com/demidyuk/recycling-react-carousel/commit/2c41ce2755d229273e6222d16f5128d35201baaa))


### Bug Fixes

* let semantic-release configure npm authentication ([836e294](https://github.com/demidyuk/recycling-react-carousel/commit/836e2947be48c19e3b7346fad941d0fbdbcd0938))
* restore alpha prereleases ([91df27a](https://github.com/demidyuk/recycling-react-carousel/commit/91df27afd707ceb3f81b9ac733af99cb329a9621))


### BREAKING CHANGES

* Replace legacy hooks and options with useCarousel and
component configuration. Require Node >=22.18.0 and React 18 or 19.
* Replace legacy hooks and configuration with useCarousel and
component options including mode, axis, and animation. Require Node >=22.18.0
and React 18 or 19.

## [1.3.2](https://github.com/demidyuk/recycling-react-carousel/compare/v1.3.1...v1.3.2) (2021-06-15)


### Bug Fixes

* add stories and additional condition for swipes ([9b47784](https://github.com/demidyuk/recycling-react-carousel/commit/9b477844b459aafe6ff1324759684005185d4c11))

## [1.3.1](https://github.com/demidyuk/recycling-react-carousel/compare/v1.3.0...v1.3.1) (2021-06-13)


### Bug Fixes

* prevent transition when change direction of swipes ([9b2051f](https://github.com/demidyuk/recycling-react-carousel/commit/9b2051f5f75edd414698b7a85f65a82fc8fc3024))

# [1.3.0](https://github.com/demidyuk/recycling-react-carousel/compare/v1.2.0...v1.3.0) (2021-06-12)


### Features

* fix bugs and add slidesToSwipe options for display rules ([d9ad52c](https://github.com/demidyuk/recycling-react-carousel/commit/d9ad52ce14aba3394238f70b4e8001564c048d5f))

# [1.2.0](https://github.com/demidyuk/recycling-react-carousel/compare/v1.1.0...v1.2.0) (2021-06-10)


### Bug Fixes

* allow default browser scrolling when swiping on non-primary axis ([8e38d1a](https://github.com/demidyuk/recycling-react-carousel/commit/8e38d1a87b71604a59cd626fa6ba166680afa147))
* prevent looping callbacks ([67de103](https://github.com/demidyuk/recycling-react-carousel/commit/67de103df4ce1adb4fa1aef4e894d62b86550949))


### Features

* add alignCenter and fitContent props ([5777c98](https://github.com/demidyuk/recycling-react-carousel/commit/5777c98da7eaabb0b103ea8acbe62e210c24dac5))
* add autosize mode ([5c07950](https://github.com/demidyuk/recycling-react-carousel/commit/5c079501f2af0a5dfd68727fde3dda718faec042))

# [1.1.0](https://github.com/demidyuk/recycling-react-carousel/compare/v1.0.2...v1.1.0) (2021-04-25)


### Bug Fixes

* change error conditions for maxItemSize and displayAtOnce ([d15260a](https://github.com/demidyuk/recycling-react-carousel/commit/d15260a3caa3c7d676c627f9a408290f04858dd8))


### Features

* add additional parameter in onRangeChange for count of slides ([4a48775](https://github.com/demidyuk/recycling-react-carousel/commit/4a487756d34c234e078e154c46220cd82723663e))
* add change reasons and optimize updates ([242c01f](https://github.com/demidyuk/recycling-react-carousel/commit/242c01fb78ba74aeaad69ffc583397bfeccc93f8))
* add cursor shifts when adding new slides ([209b288](https://github.com/demidyuk/recycling-react-carousel/commit/209b28892d824cc78d92420fd51b97fbb3068b13))
* add defaultCursor prop and snapshot testing ([6bc677e](https://github.com/demidyuk/recycling-react-carousel/commit/6bc677e63f1f9afe07b4cbf9a725a97e09b56dc8))
* add loop mode ([ec59182](https://github.com/demidyuk/recycling-react-carousel/commit/ec59182ab1e151e7966c42ba40ed3cfb84c22d08))
* add swipeThreshold prop ([b0390c7](https://github.com/demidyuk/recycling-react-carousel/commit/b0390c70ef17c3075872e7ca141f8adf656ba239))
* add trimEnd prop ([be917dd](https://github.com/demidyuk/recycling-react-carousel/commit/be917dd812cb9d400b6c849fe703635e23093fef))
* add userSelect and springConfig props, enhance displayAtOnce to support breakpoints ([231312e](https://github.com/demidyuk/recycling-react-carousel/commit/231312e375afd8693b5ee44921c49b3d709a7643))
* refactor code in useCursor hook and add  goTo method ([39ae9d2](https://github.com/demidyuk/recycling-react-carousel/commit/39ae9d28217ee6144b636c18bf405a62e38caa24))

## [1.0.2](https://github.com/demidyuk/recycling-react-carousel/compare/v1.0.1...v1.0.2) (2021-03-18)


### Bug Fixes

* fix bug with init prop of useCursor ([6fa2782](https://github.com/demidyuk/recycling-react-carousel/commit/6fa2782f0ef28cfdbcf7da6cc81b67db67ffeaab))

## [1.0.1](https://github.com/demidyuk/recycling-react-carousel/compare/v1.0.0...v1.0.1) (2021-03-14)


### Bug Fixes

* make item wrapper width 100% on the y-axis ([82ae8b9](https://github.com/demidyuk/recycling-react-carousel/commit/82ae8b915609aef1c912e374d9a3befa37c1e18a))

# 1.0.0 (2021-03-13)


### Features

* initial commit ([50782f3](https://github.com/demidyuk/recycling-react-carousel/commit/50782f34e489d90d08b61adc5004f3c3822ac8a2))
