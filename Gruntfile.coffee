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
        "# Licensed <%= _.pluck(pkg.licenses, \"type\").join(\", \") %>.\n" +
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
        src: ['build/dependencies/bower_dependencies.js', 'build/transpiled/namespace.js', 'build/transpiled/client.js']
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
      src: 'build/dist/<%= pkg.name %>.js'

    bump:
      options:
        files: ['package.json', 'bower.json']
        updateConfigs: ['pkg']
        commit: false
        createTag: false
        push: false

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
        src: ['build/dist/']
        dest: 'release/'

    release:
      options:
        bump: false
        commitMessage: 'Release <%= version %>'

    bowerRelease:
      main:
        options:
          endpoint: 'git://github.com/integrallis/binnacle-js.git'
          packageName: 'some-package-stable.js'
          stageDir: 'staging-stable/'
        files: [
          expand: true
          cwd: 'build/stable/'
          src: [
            'binnacle.js'
            'binnacle.min.js'
          ]
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
  grunt.registerTask 'test', ['build', 'jasmine']

  grunt.registerTask 'publish', ['publish:patch']
  grunt.registerTask 'publish:patch', ['clean', 'test', 'bump:patch', 'copy:release', 'release']
  grunt.registerTask 'publish:minor', ['clean', 'test', 'bump:minor', 'copy:release', 'release']
  grunt.registerTask 'publish:major', ['clean', 'test', 'bump:major', 'copy:release', 'release']
