'use strict'

module.exports = (grunt)->
  # project configuration
  grunt.initConfig
    # load package information
    pkg: grunt.file.readJSON 'package.json'

    meta:
      banner: "/* ===========================================================\n" +
        "# <%= pkg.title || pkg.name %> - v<%= pkg.version %>\n" +
        "# ==============================================================\n" +
        "# Copyright (c) <%= grunt.template.today(\"yyyy\") %> <%= pkg.author.name %>\n" +
        "# Licensed <%= _.map(pkg.licenses, \"type\").join(\", \") %>.\n" +
        "*/\n"

    coffeelint:
      options:
        indentation:
          value: 2
          level: 'error'
        no_trailing_semicolons:
          level: 'error'
        no_trailing_whitespace:
          level: 'error'
        max_line_length:
          level: 'ignore'
      default: ['Gruntfile.coffee', 'src/**/*.coffee']

    clean: ['build', 'bower_components']

    coffee:
      options:
        bare: true
      default:
        expand: true
        flatten: true
        cwd: 'src/coffee'
        src: ['*.coffee']
        dest: 'build/transpiled'
        ext: '.js'
      test:
        expand: true
        flatten: true
        cwd: 'src/spec'
        src: ['*.spec.coffee']
        dest: 'build/test'
        ext: '.spec.js'

    concat:
      options:
        banner: '<%= meta.banner %>'
        stripBanners: true
      dist:
        src: ['build/dependencies/bower_dependencies.js', 'build/transpiled/http.js', 'build/transpiled/client.js']
        dest: 'build/dist/binnacle.js'

    uglify:
      options:
        banner: '<%= meta.banner %>'
        mangle: true
        compress: true
      dist:
        src: 'build/dist/<%= pkg.name %>.js'
        dest: 'build/dist/<%= pkg.name %>.min.js'

    # watching for changes
    watch:
      default:
        files: ['src/coffee/*.coffee']
        tasks: ['build']
      test:
        files: ['src/**/*.coffee']
        tasks: ['test']

    shell:
      options:
        stdout: true
        stderr: true
        failOnError: true
      publish:
        command: 'npm publish'

    jasmine:
      options:
        vendor: ['build/lib/atmosphere/atmosphere.js', 'build/lib/moment/moment.js']
        specs: 'build/test/*.spec.js'
      src: 'build/transpiled/client.js'

      coverage:
        src: ['build/transpiled/http.js', 'build/transpiled/client.js']
        options:
          specs: 'build/test/<%= pkg.name %>.spec.js'
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/coverage.json'
            report: [
              {
                type: 'html'
                options: dir: 'build/coverage/html'
              }
              {
                type: 'lcov'
                options:
                  dir: 'build/coverage/lcov'
              }
              { type: 'text-summary' }
            ]

    bump:
      options:
        files: ['package.json', 'bower.json']
        updateConfigs: ['pkg']
        pushTo: 'origin'

    bower:
      install:
        options:
          targetDir: 'build/lib'

    bower_concat:
      all:
        dest: 'build/dependencies/bower_dependencies.js'
        exclude: [
          'jquery'
        ]
        include: [
          'atmosphere', 'moment'
        ]
        bowerOptions:
          relative: false

    copy:
      release:
        expand: true
        flatten: true
        src: ['build/dist/*.js']
        dest: 'release/'
        filter: 'isFile'

    release:
      options:
        bump: false
        commitMessage: 'Release <%= version %>'
        commit: false
        tag: false
        push: false

    bowerRelease:
      main:
        options:
          endpoint: 'git://github.com/integrallis/binnacle-js.git'
          stageDir: 'staging/'
        files: [
          {
            expand: true
            cwd: 'release/'
            src: [
              'binnacle.js'
              'binnacle.min.js'
            ]
          }
        ]

  # load plugins that provide the tasks defined in the config
  grunt.loadNpmTasks 'grunt-bump'
  grunt.loadNpmTasks 'grunt-coffeelint'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-contrib-concat'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-contrib-uglify'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-shell'
  grunt.loadNpmTasks 'grunt-bower-task'
  grunt.loadNpmTasks 'grunt-bower-concat'
  grunt.loadNpmTasks 'grunt-release'
  grunt.loadNpmTasks 'grunt-bower-release'

  # register tasks
  grunt.registerTask 'default', ['build']
  grunt.registerTask 'build', ['clean', 'bower', 'coffeelint', 'coffee', 'bower_concat', 'concat', 'uglify']
  grunt.registerTask 'test', ['build', 'jasmine', 'jasmine:coverage']

  grunt.registerTask 'publish', ['publish:patch']
  grunt.registerTask 'publish:patch', ['clean', 'bump:patch', 'test', 'copy:release', 'release', 'bowerRelease:main']
  grunt.registerTask 'publish:minor', ['clean', 'bump:minor', 'test', 'copy:release', 'release', 'bowerRelease:main']
  grunt.registerTask 'publish:major', ['clean', 'bump:major', 'test', 'copy:release', 'release', 'bowerRelease:main']
