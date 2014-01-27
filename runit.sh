#!/bin/bash

for RECIPE in {44..49}
do
    URL=http://mako.dev/cooksillustrated/recipes/recipe-${RECIPE}.html
    RESULT=`curl -o /dev/null --silent --head --write-out '%{http_code}\n' ${URL}`
    if [ $RESULT -eq 200 ]
    then
        echo "Number: ${RECIPE}, press return to parse the next recipe."
        node scrub-cooks-illustrated.js --url ${URL}
        python -mwebbrowser ${URL}
        read
    fi
done
