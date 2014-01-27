#!/bin/bash

for RECIPE in {36..39}
do
    URL=http://mako.dev/cooksillustrated/recipes/recipe-${RECIPE}.html
    RESULT=`curl -o /dev/null --silent --head --write-out '%{http_code}\n' ${URL}`
    if [ $RESULT -eq 200 ]
    then
        echo "Number: ${RECIPE}, press return to parse the next recipe."
        node scrub-cooks-illustrated.js --debug --url ${URL}
        python -mwebbrowser ${URL}
        read
    fi
done
