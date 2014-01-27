#!/bin/bash

for RECIPE in {72..79}
do
    URL=http://mako.dev/cooksillustrated/recipes/recipe-${RECIPE}.html
    RESULT=`curl -o /dev/null --silent --head --write-out '%{http_code}\n' ${URL}`
    if [ $RESULT -eq 200 ]
    then
        echo "Number: ${RECIPE}, press return to parse the next recipe."
        node scrub-cooks-illustrated.js --url ${URL}
        NAME=`node scrub-cooks-illustrated.js --title --url ${URL}`
        NAME=`echo "${NAME}" | grep -n 'Recipe Title' | awk -F'[:]' '{print $3}'`
        QUERY="$(perl -MURI::Escape -e 'print uri_escape($ARGV[0]);' "${NAME}")"
        python -mwebbrowser "http://images.google.com/search?tbm=isch&q=${QUERY}"
        python -mwebbrowser ${URL}
        read
    fi
done
